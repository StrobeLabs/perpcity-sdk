import { parseAbi } from "viem";

/** Controller interface from perpcity-contracts e996edf; release activation is explicit. */
export const WITHDRAWAL_CONTROLLER_ABI = parseAbi([
  "function perp() view returns (address)",
  "function challengeWindow() view returns (uint48)",
  "function releasesPaused() view returns (bool)",
  "function totalReserved() view returns (uint256)",
  "function nextClaimId() view returns (uint256)",
  "function rateLimit() view returns (uint128 capacity, uint128 available, uint128 refillPerSecond, uint48 lastUpdated)",
  "function claims(uint256 claimId) view returns (uint128 originalAmount, uint128 currentAmount, address recipient, uint48 createdAt, uint8 status, bool paused)",
  "function release(uint256 claimId)",
  "function pauseReleases()",
  "function increaseChallengeWindow(uint48 newWindow)",
  "function unpauseReleases()",
  "event ControllerInitialized(address indexed perp, uint128 capacity, uint128 refillPerSecond, uint48 challengeWindow)",
  "event ClaimCreated(uint256 indexed claimId, address indexed recipient, uint128 amount)",
  "event ClaimReleased(uint256 indexed claimId, address indexed recipient, uint128 amount)",
  "event ClaimReduced(uint256 indexed claimId, uint128 oldAmount, uint128 newAmount, bytes32 evidenceHash, address guardian)",
  "event ClaimPaused(uint256 indexed claimId)",
  "event ClaimUnpaused(uint256 indexed claimId)",
  "event InstantPayout(address indexed recipient, uint128 amount, uint128 availableAfter)",
  "event ChallengeWindowSet(uint48 challengeWindow)",
  "event RateLimitSet(uint128 capacity, uint128 refillPerSecond)",
  "event ReleasesPaused()",
  "event ReleasesUnpaused()",
  "error ClaimNotPending()",
  "error ReleasesArePaused()",
  "error ClaimIsPaused()",
  "error ClaimNotReady()",
  "error TvlCapExceeded()",
]);

export const PERP_WITHDRAWAL_ABI = parseAbi([
  "function withdrawalController() view returns (address)",
  "function owner() view returns (address)",
  "function governor() view returns (address)",
  "function accountedTvl() view returns (uint256)",
  "function tvlCap() view returns (uint256)",
  "event SetWithdrawalController(address indexed controller)",
]);

/** Explicit current-main calls; legacy PERP_ABI remains tied to deployed builds. */
export const PROTECTED_PERP_ACTION_ABI = parseAbi([
  "function openMaker((address holder,uint128 margin,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 maxAmt0In,uint256 maxAmt1In,uint64 deadline) params) returns (uint256 posId)",
  "function adjustMaker((uint256 posId,int128 marginDelta,int128 liquidityDelta,uint256 amt0Limit,uint256 amt1Limit,uint64 deadline) params)",
  "function openTaker((address holder,uint128 margin,int256 perpDelta,uint256 amt1Limit,uint256 maxTotalFee,uint64 deadline) params) returns (uint256 posId)",
  "function adjustTaker((uint256 posId,int128 marginDelta,int256 perpDelta,uint256 amt1Limit,uint256 maxTotalFee,bool reduceOnly,uint64 deadline) params)",
]);
