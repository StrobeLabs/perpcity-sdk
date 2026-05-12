# PerpCity SDK Migration Notes

## Contract Model

The SDK now targets the v2 contract model from `../perpcity-contracts`:

- Markets are individual `Perp` contracts.
- `PerpFactory` creates markets and emits the new market address.
- The old global coordinator model is deprecated.
- Existing `perpId` names are treated as a compatibility alias for the Perp contract address.

## Main Interface Changes

- Position reads and mutations must include the Perp address because `positionId` values are local to each market.
- USDC approvals must use the Perp contract as spender, not a global contract.
- `getUsdcAllowance` and `approveUsdc` require an explicit spender address; do not fall back to `deployments.perpAddress` for approvals.
- Taker-native actions use `perpDelta` and `amt1Limit`.
- The old leverage-based taker open wrapper has been removed from the mutation path; `estimateTakerPosition` remains a client-side helper for deriving a best-effort delta.
- Old quote helpers do not have exact v2 contract equivalents. The SDK only exposes best-effort estimates unless contract quote/preview methods are added.

## Updated SDK Areas

- ABIs regenerated from `../perpcity-contracts/out` for `Perp`, `PerpFactory`, modules, and `ProtocolFeeManager`.
- `PerpCityContext` reads market config/data directly from a `Perp` contract.
- Market creation uses `PerpFactory.createPerp`.
- Maker/taker open and adjust helpers call `Perp.openMaker`, `Perp.openTaker`, `Perp.adjustMaker`, and `Perp.adjustTaker`.
- Position raw data reads use `Perp.positions` and `Perp.makerDetails`.
- `BalanceDelta` values from the contract are unpacked into signed `amount0` and `amount1`.
- Taker opens now require caller-supplied `perpDelta` and `amt1Limit`; maker opens require caller-supplied `maxAmt0In` and `maxAmt1In`.
- Live position detail placeholders were removed because v2 contracts do not expose a complete live-risk view.
- Legacy `PerpManager` naming was removed from SDK code; action helpers live in `src/functions/perp-actions.ts`.

## Test Harness Changes

- The legacy global mock was replaced by v2-shaped mocks for `Perp`, `PerpFactory`, `ProtocolFeeManager`, and `Beacon`.
- Existing module mocks now expose the tuple-returning `fees`, `liqFee`, `takerMarginRatios`, and `makerMarginRatios` functions used by the new SDK reads.
- Integration tests deploy an isolated local Anvil instance on a free port and use the deployed `MockPerp` address as `testPerpId`.
- Approval tests pass the Perp contract as the explicit spender and assert USDC allowance against it.
- Position read tests now pass both Perp address and position id.

## Client Notes

`../perpcity-client` is outside this repo's writable root in this session. The client still needs a follow-up pass:

- Use `perpAddress` for v2 Perp markets.
- Ensure API `perp_id` values are Perp addresses, or expose a separate `perp_address`.
- Replace direct `PERP_ABI` calls in adjust hooks with SDK helpers.
- Pass Perp address into all position read/estimate hooks.

## Verification

Run these from the SDK repo:

```sh
forge build
pnpm exec tsc --noEmit
pnpm lint
pnpm test:unit -- --run
pnpm test:integration
pnpm build
```
