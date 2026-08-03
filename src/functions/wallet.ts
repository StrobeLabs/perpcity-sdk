import { type Address, erc20Abi } from "viem";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import { getUsdcAllowance } from "../utils/approve";
import { MIN_OPENING_MARGIN_USD } from "../utils/constants";
import { scale6Decimals } from "../utils/conversions";
import { type PerpCityErrorCode, ValidationError } from "../utils/errors";
import { estimateFeesWithHeadroom } from "../utils/fees";

// Gas-limit ceiling for the preflight affordability check: covers an approve
// plus an openTaker with headroom. Deliberately generous - the check answers
// "can this wallet trade at all", not "what will this trade cost".
const PREFLIGHT_GAS_LIMIT = 3_000_000n;

function resolveAddress(context: PerpCityContext, address?: Address): Address {
  const resolved = address ?? context.walletClient.account?.address;
  if (!resolved) {
    throw new ValidationError(
      "No address given and the wallet client has no account. Pass an address explicitly."
    );
  }
  return resolved;
}

/**
 * The wallet's USDC balance, raw 6-decimal units.
 * Defaults to the context's wallet account.
 */
export async function getUsdcBalance(context: PerpCityContext, address?: Address): Promise<bigint> {
  const owner = resolveAddress(context, address);
  return context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  }) as Promise<bigint>;
}

/**
 * The wallet's native balance in wei - what pays for gas (ETH on Arbitrum).
 * Defaults to the context's wallet account.
 */
export async function getGasBalance(context: PerpCityContext, address?: Address): Promise<bigint> {
  const owner = resolveAddress(context, address);
  return context.publicClient.getBalance({ address: owner });
}

export type WalletStatus = {
  address: Address;
  /** USDC balance, raw 6-decimal units. */
  usdcBalance: bigint;
  /** Native balance in wei. */
  gasBalance: bigint;
  /** USDC allowance for the given perp; only present when perpAddress was given. */
  usdcAllowance?: bigint;
};

/**
 * One-call wallet snapshot for bots: USDC balance, gas balance, and (when a
 * perp is given) the USDC allowance for that market. The reads are issued
 * together and coalesce into the client's multicall/JSON-RPC batch.
 */
export async function getWalletStatus(
  context: PerpCityContext,
  opts: { address?: Address; perpAddress?: PerpAddress } = {}
): Promise<WalletStatus> {
  const address = resolveAddress(context, opts.address);
  const [usdcBalance, gasBalance, usdcAllowance] = await Promise.all([
    getUsdcBalance(context, address),
    getGasBalance(context, address),
    opts.perpAddress ? getUsdcAllowance(context, address, opts.perpAddress) : undefined,
  ]);
  return { address, usdcBalance, gasBalance, usdcAllowance };
}

export type PreflightCheck = {
  ok: boolean;
  /** Set when the check failed; matches the code the eventual error would carry. */
  code?: PerpCityErrorCode;
  message: string;
};

export type OpenTakerPreflight = {
  /** True when every blocking check passed (a short allowance is informational:
   * the SDK write paths top it up automatically). */
  ok: boolean;
  checks: {
    minMargin: PreflightCheck;
    usdcBalance: PreflightCheck;
    usdcAllowance: PreflightCheck;
    gasBalance: PreflightCheck;
  };
  balances: { usdcBalance: bigint; usdcAllowance: bigint; gasBalance: bigint };
};

/**
 * Opt-in pre-trade checks for openTakerPosition: minimum margin, USDC balance,
 * USDC allowance, and gas affordability. Returns a structured report and never
 * throws on failed checks, so bots can branch (and record metrics) on the same
 * codes the write path's errors would carry.
 *
 * Not called by the write paths themselves - simulation already catches these
 * conditions at send time; this exists to check cheaply and in advance.
 */
export async function preflightOpenTaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: { margin: number },
  opts: { address?: Address; minGasWei?: bigint } = {}
): Promise<OpenTakerPreflight> {
  const address = resolveAddress(context, opts.address);

  const [status, minGasWei] = await Promise.all([
    getWalletStatus(context, { address, perpAddress }),
    opts.minGasWei !== undefined
      ? Promise.resolve(opts.minGasWei)
      : estimateFeesWithHeadroom(context.publicClient).then(
          ({ maxFeePerGas }) => PREFLIGHT_GAS_LIMIT * maxFeePerGas
        ),
  ]);

  const requiredUsdc = params.margin > 0 ? scale6Decimals(params.margin) : 0n;
  const usdcAllowance = status.usdcAllowance ?? 0n;

  const minMargin: PreflightCheck =
    params.margin >= MIN_OPENING_MARGIN_USD
      ? { ok: true, message: `Margin meets the ${MIN_OPENING_MARGIN_USD} USDC minimum.` }
      : {
          ok: false,
          code: "MARGIN_BELOW_MINIMUM",
          message: `Margin ${params.margin} is below the ${MIN_OPENING_MARGIN_USD} USDC minimum.`,
        };

  const usdcBalance: PreflightCheck =
    status.usdcBalance >= requiredUsdc
      ? { ok: true, message: "USDC balance covers the margin." }
      : {
          ok: false,
          code: "INSUFFICIENT_USDC_BALANCE",
          message: `USDC balance ${status.usdcBalance} is below the required ${requiredUsdc}.`,
        };

  const allowanceCheck: PreflightCheck =
    usdcAllowance >= requiredUsdc
      ? { ok: true, message: "USDC allowance covers the margin." }
      : {
          ok: false,
          code: "INSUFFICIENT_USDC_ALLOWANCE",
          message: `USDC allowance ${usdcAllowance} is below the margin ${requiredUsdc}; the SDK will submit an approval before opening.`,
        };

  const gasBalance: PreflightCheck =
    status.gasBalance >= minGasWei
      ? { ok: true, message: "Gas balance covers the transaction." }
      : {
          ok: false,
          code: "INSUFFICIENT_GAS",
          message: `Gas balance ${status.gasBalance} wei is below the required ${minGasWei} wei.`,
        };

  return {
    ok: minMargin.ok && usdcBalance.ok && gasBalance.ok,
    checks: { minMargin, usdcBalance, usdcAllowance: allowanceCheck, gasBalance },
    balances: {
      usdcBalance: status.usdcBalance,
      usdcAllowance,
      gasBalance: status.gasBalance,
    },
  };
}
