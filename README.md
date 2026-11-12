# PerpCity SDK

TypeScript SDK for Perp City perpetual futures contracts on Arbitrum.

**1.x targets perpcity-contracts `v1.0.0` only** (`0df4208`, `lib/beacons` `f762da1`). For
v0.x markets (58b42b7, v0.2.2-upgradeable), stay on `0.19.x`. An app that must read both can
install the old major under an alias:

```json
"@strobelabs/perpcity-sdk": "^1.0.0",
"perpcity-sdk-legacy": "npm:@strobelabs/perpcity-sdk@0.19.x"
```

A v1 read with a v0 ABI (or the reverse) does not fail: `positions`, `makerDetails`, `rates`
and `cumulatives` keep their selectors but change their return shapes. Select the SDK by the
perp's build, never by trial.

# Docs
You can find detailed docs in the [Perp City docsite](https://docs.perp.city)

## Installation

```bash
pnpm add @strobelabs/perpcity-sdk
```

## Quick Start

```typescript
import { PerpCityContext, V1_DEPLOYMENTS, getRpcUrl } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

const rpcUrl = getRpcUrl();
const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});

const context = new PerpCityContext({
  rpcUrl,
  walletClient,
  deployments: V1_DEPLOYMENTS.arbitrumSepolia,
});
```

## v1 trades

Every write carries a `deadline` (unix seconds; default now + 10 minutes). Taker trades also
carry `maxTotalFee` (USDC, 6 decimals: the cap on LP + protocol + creator + insurance fees),
and taker adjustments carry `reduceOnly`. `closePosition` and `buildClosePositionCall` always
close a taker with `reduceOnly: true`.

```typescript
import { maxTotalFeeFor, openTakerPosition } from '@strobelabs/perpcity-sdk';

const { fees } = await context.getPerpData(perp);
const maxTotalFee = maxTotalFeeFor(usdNotional, {
  maxSwapFeeE6: BigInt(Math.round(fees.maxSwapFee * 1e6)),
  protocolFeeE6: BigInt(Math.round(fees.protocolFee * 1e6)),
});
await openTakerPosition(context, perp, { margin: 100, perpDelta, amt1Limit, maxTotalFee });
```

The `build*Call` / `build*Calls` functions return the same calldata as the executed functions,
for userOperation batches. `simulateCalls` preflights a batch with `eth_simulateV1`.

## Positions and market state

The SDK does not reimplement v1 margin math. Read the contract's own numbers:

- `context.getPositionPreview(perp, posId)` (`previewPosition`): settled margin, pending
  funding, utilization and LP fees, value, unrealized PnL, equity, `liquidatable`. Use
  `summarizePreview` for display units.
- `context.getPositionRawData(perp, posId)`: owner, margin, perp and USD inventory, maker range.
- `readPerpView(client, perp, name, args)`: any v1 Perp view with the vendored ABI. Typed
  readers: `readPosition`, `readMakerDetails`, `readTakerDetails`, `readPositionPreview`,
  `readRates`, `readCumulatives`.
- `context.getPerpData(perp)`: pool state, cached rates and mark, margin ratios, fee bounds,
  open interest, TVL cap.

## Withdrawal claims

Each v1 market has a `WithdrawalController` (`getPerpConfig(perp).withdrawalController`). A
payout above the instant rate limit becomes a queued claim; the position action still
succeeded. Read the controller and its claim at the same block with `readWithdrawalController`
and `readWithdrawalClaim`, then evaluate `withdrawalEligibility`. Pass receipt logs and
verified controller/perp bindings to `decodeWithdrawalPayouts`, and keep every result: one
transaction can hold several claims and instant payouts. `buildReleaseWithdrawalClaimCall` /
`releaseWithdrawalClaim` release a ready claim (permissionless; always pays the claim's
recipient). Reverts decode to `WITHDRAWAL_NOT_READY`, `WITHDRAWAL_PAUSED`,
`WITHDRAWAL_NOT_PENDING` and `TVL_CAP_EXCEEDED`.

## Errors

`parseContractError` decodes every v1.0.0 revert (Perp and its libraries, factory, guard hook,
withdrawal controller, modules, beacon and verifier, Uniswap V4, solady) and sets a stable
`code`. v1 adds `DEADLINE_EXPIRED`, `FEE_CAP_EXCEEDED`, `REDUCE_ONLY_VIOLATED`,
`CLOSE_CAPACITY_EXCEEDED` and `STALE_INDEX` (a stale beacon pauses the whole market,
including closes).

## Development

### ABIs

`src/abis/*.ts` are generated from a perpcity-contracts build at tag `v1.0.0`:

```bash
git -C ../perpcity-contracts checkout v1.0.0 && (cd ../perpcity-contracts && forge build --skip test --skip script)
pnpm sync:abis ../perpcity-contracts   # Node >= 22.6
```

### Test

```bash
pnpm test:unit

# v1 fork test: anvil forks Arbitrum Sepolia, makes a fresh v1.0.0 market through the
# deployed v1 factories, trades on it, and checks every Perp view against the raw eth_call.
# Set PERPCITY_V1_PERP (and PERPCITY_V1_POSITION) to read a listed perp instead.
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc pnpm test:integration
```

### CI

```bash
pnpm ci   # build + unit tests + typecheck + lint
```

## License

MIT

## Links

- [Perp City Documentation](https://docs.perp.city)
- [Perp City App](https://app.perp.city)
