import type { Address, Hex } from "viem";
import { decodeAbiParameters, decodeEventLog, erc20Abi, keccak256, toBytes } from "viem";
import { PERP_ABI } from "../abis/perp";
import { PERP_FACTORY_ABI } from "../abis/perp-factory";
import type { PerpCityContext } from "../context";
import type {
  CreatePerpParams,
  EstimateTakerPositionResult,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
} from "../types/entity-data";
import { MAX_TICK, MIN_TICK, NUMBER_1E6, priceToTick, scale6Decimals } from "../utils";
import { approveUsdc } from "../utils/approve";
import { withErrorHandling } from "../utils/errors";
import { OpenPosition } from "./open-position";

const MAKER_OPENED_TOPIC = keccak256(toBytes("MakerOpened(uint256)"));
const TAKER_OPENED_TOPIC = keccak256(
  toBytes("TakerOpened(uint256,(int256,uint256,int256,uint256,uint256,uint256,uint256))")
);

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();
    const perpFactory = deployments.perpFactory;
    if (!perpFactory) throw new Error("perpFactory deployment address is required");

    const modules = {
      beacon: params.beacon,
      fees: params.fees ?? deployments.feesModule,
      funding: params.funding ?? deployments.fundingModule,
      marginRatios: params.marginRatios ?? deployments.marginRatiosModule,
      priceImpact: params.priceImpact ?? deployments.priceImpactModule,
      pricing: params.pricing ?? deployments.pricingModule,
    };

    if (
      !modules.fees ||
      !modules.funding ||
      !modules.marginRatios ||
      !modules.priceImpact ||
      !modules.pricing
    ) {
      throw new Error("All module addresses must be provided in params or deployment config");
    }

    const { request } = await context.publicClient.simulateContract({
      address: perpFactory,
      abi: PERP_FACTORY_ABI,
      functionName: "createPerp",
      args: [
        params.owner,
        params.name,
        params.symbol,
        params.tokenUri,
        modules as {
          beacon: Address;
          fees: Address;
          funding: Address;
          marginRatios: Address;
          priceImpact: Address;
          pricing: Address;
        },
        params.emaWindow,
        params.salt,
      ],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error(`Transaction reverted. Hash: ${txHash}`);

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_FACTORY_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "PerpCreated",
        });
        return decoded.args.perp as Hex;
      } catch (_e) {}
    }

    throw new Error("PerpCreated event not found in transaction receipt");
  }, "createPerp");
}

export function derivePerpDelta(opts: {
  margin: number;
  leverage: number;
  price: number;
  isLong: boolean;
}): bigint {
  if (opts.margin <= 0) throw new Error("Margin must be greater than 0");
  if (opts.leverage <= 0) throw new Error("Leverage must be greater than 0");
  if (opts.price <= 0) throw new Error("Price must be greater than 0");

  const marginScaled = scale6Decimals(opts.margin);
  const leverageScaled = BigInt(Math.floor(opts.leverage * NUMBER_1E6));
  const priceScaled = scale6Decimals(opts.price);
  const notional = (marginScaled * leverageScaled) / BigInt(NUMBER_1E6);
  const perpSize = (notional * BigInt(NUMBER_1E6)) / priceScaled;
  return opts.isLong ? perpSize : -perpSize;
}

async function ensureUsdcAllowance(
  context: PerpCityContext,
  spender: Address,
  requiredAmount: bigint
): Promise<void> {
  const account = context.walletClient.account?.address;
  if (!account) throw new Error("Wallet account is required");

  const currentAllowance = await context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
    blockTag: "latest",
  });
  if (currentAllowance < requiredAmount) {
    await approveUsdc(context, requiredAmount, spender, 2);
  }
}

export async function openTakerPosition(
  context: PerpCityContext,
  perpAddress: Hex,
  params: OpenTakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");

    const marginScaled = scale6Decimals(params.margin);
    await ensureUsdcAllowance(context, perpAddress, marginScaled);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "openTaker",
      args: [
        {
          holder: context.walletClient.account!.address,
          margin: marginScaled,
          perpDelta: params.perpDelta,
          amt1Limit: params.amt1Limit,
        },
      ],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error(`Transaction reverted. Hash: ${txHash}`);

    for (const log of receipt.logs) {
      try {
        if (
          log.address.toLowerCase() !== perpAddress.toLowerCase() ||
          log.topics[0] !== TAKER_OPENED_TOPIC ||
          log.data === "0x"
        ) {
          continue;
        }
        const [posId] = decodeAbiParameters([{ type: "uint256" }], log.data);
        return new OpenPosition(context, perpAddress, posId, params.perpDelta > 0n, false, txHash);
      } catch (_e) {}
    }
    throw new Error(`TakerOpened event not found in transaction receipt. Hash: ${txHash}`);
  }, "openTakerPosition");
}

function buildMakerContractParams(
  context: PerpCityContext,
  marginScaled: bigint,
  params: OpenMakerPositionParams,
  alignedTickLower: number,
  alignedTickUpper: number,
  maxAmt0In: bigint,
  maxAmt1In: bigint
) {
  return {
    holder: context.walletClient.account!.address,
    margin: marginScaled,
    tickLower: alignedTickLower,
    tickUpper: alignedTickUpper,
    liquidity: params.liquidity,
    maxAmt0In,
    maxAmt1In,
  };
}

export function calculateAlignedTicks(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number
): { alignedTickLower: number; alignedTickUpper: number } {
  const tickLower = priceToTick(priceLower, true);
  const tickUpper = priceToTick(priceUpper, false);

  const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

  if (alignedTickLower < MIN_TICK) {
    throw new Error(
      `Lower tick ${alignedTickLower} is below MIN_TICK (${MIN_TICK}). Increase priceLower.`
    );
  }
  if (alignedTickUpper > MAX_TICK) {
    throw new Error(
      `Upper tick ${alignedTickUpper} exceeds MAX_TICK (${MAX_TICK}). Decrease priceUpper.`
    );
  }
  if (alignedTickLower === alignedTickUpper) {
    throw new Error(
      "Price range too narrow: lower and upper ticks are equal after alignment. Widen the range."
    );
  }

  return { alignedTickLower, alignedTickUpper };
}

export async function openMakerPosition(
  context: PerpCityContext,
  perpAddress: Hex,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.priceLower >= params.priceUpper)
      throw new Error("priceLower must be less than priceUpper");

    const marginScaled = scale6Decimals(params.margin);
    const perpData = await context.getPerpData(perpAddress);
    const { alignedTickLower, alignedTickUpper } = calculateAlignedTicks(
      params.priceLower,
      params.priceUpper,
      perpData.tickSpacing
    );

    const maxAmt0In =
      typeof params.maxAmt0In === "bigint" ? params.maxAmt0In : scale6Decimals(params.maxAmt0In);
    const maxAmt1In =
      typeof params.maxAmt1In === "bigint" ? params.maxAmt1In : scale6Decimals(params.maxAmt1In);

    await ensureUsdcAllowance(context, perpAddress, marginScaled);

    const contractParams = buildMakerContractParams(
      context,
      marginScaled,
      params,
      alignedTickLower,
      alignedTickUpper,
      maxAmt0In,
      maxAmt1In
    );

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "openMaker",
      args: [contractParams],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error(`Transaction reverted. Hash: ${txHash}`);

    for (const log of receipt.logs) {
      try {
        if (
          log.address.toLowerCase() !== perpAddress.toLowerCase() ||
          log.topics[0] !== MAKER_OPENED_TOPIC ||
          log.data === "0x"
        ) {
          continue;
        }
        const [posId] = decodeAbiParameters([{ type: "uint256" }], log.data);
        return new OpenPosition(context, perpAddress, posId, undefined, true, txHash);
      } catch (_e) {}
    }
    throw new Error(`MakerOpened event not found in transaction receipt. Hash: ${txHash}`);
  }, "openMakerPosition");
}

export async function estimateTakerPosition(
  context: PerpCityContext,
  perpAddress: Hex,
  params: {
    isLong: boolean;
    margin: number;
    leverage: number;
  }
): Promise<EstimateTakerPositionResult> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpAddress);
    const perpDelta = derivePerpDelta({
      margin: params.margin,
      leverage: params.leverage,
      price: perpData.mark,
      isLong: params.isLong,
    });
    const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
    const usdDelta = (absPerpDelta * scale6Decimals(perpData.mark)) / BigInt(NUMBER_1E6);
    return {
      perpDelta,
      usdDelta: params.isLong ? -usdDelta : usdDelta,
      fillPrice: perpData.mark,
    };
  }, "estimateTakerPosition");
}

export async function adjustTaker(
  context: PerpCityContext,
  perpAddress: Hex,
  params: { posId: bigint; marginDelta: bigint; perpDelta: bigint; amt1Limit: bigint }
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    if (params.marginDelta > 0n)
      await ensureUsdcAllowance(context, perpAddress, params.marginDelta);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "adjustTaker",
      args: [params],
      account: context.walletClient.account,
    });
    const txHash = await context.walletClient.writeContract(request);
    return { txHash };
  }, `adjustTaker for position ${params.posId}`);
}

export async function adjustMaker(
  context: PerpCityContext,
  perpAddress: Hex,
  params: {
    posId: bigint;
    marginDelta: bigint;
    liquidityDelta: bigint;
    amt0Limit: bigint;
    amt1Limit: bigint;
  }
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    if (params.marginDelta > 0n)
      await ensureUsdcAllowance(context, perpAddress, params.marginDelta);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "adjustMaker",
      args: [params],
      account: context.walletClient.account,
    });
    const txHash = await context.walletClient.writeContract(request);
    return { txHash };
  }, `adjustMaker for position ${params.posId}`);
}

export async function adjustMargin(
  context: PerpCityContext,
  perpAddress: Hex,
  positionId: bigint,
  marginDelta: bigint
): Promise<{ txHash: Hex }> {
  const rawData = await context.getPositionRawData(perpAddress, positionId);
  if (rawData.makerDetails) {
    return adjustMaker(context, perpAddress, {
      posId: positionId,
      marginDelta,
      liquidityDelta: 0n,
      amt0Limit: 0n,
      amt1Limit: 0n,
    });
  }
  return adjustTaker(context, perpAddress, {
    posId: positionId,
    marginDelta,
    perpDelta: 0n,
    amt1Limit: 0n,
  });
}
