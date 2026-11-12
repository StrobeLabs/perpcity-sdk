import type { PerpCityDeployments } from "./types";

/**
 * perpcity-contracts v1.0.0 deployments (perpcity-deployments PR #3, README at
 * 2c333a5). Only the v1.0.0 factories are listed: v0.x perps are not
 * supported by this SDK major.
 */
export const V1_DEPLOYMENTS = {
  /** Arbitrum One (chain id 42161). */
  arbitrum: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    perpFactory: "0x1c4ad3b988d5643dE581d078abf515E77c185E18",
    perpGuardHook: "0x63adaa672d90B91e361C3f52552ee885A6D6AaA0",
    protocolFeeManager: "0xE8b5Fce09ebbEcDE06bCEe7c58F399b668557445",
    moduleRegistry: "0x22e2C8Cb9Cc08D4D330172254cf344822225962A",
    pricingModule: "0xA5238656Fee3c948c6CbcA4FF0628e4767dFa29d",
    fundingModule: "0x9DFA23191e918d4ea72407c42bfA581Dd1E63436",
    feesModule: "0xf077cf5454EE60e97618786Fc0630f043e3d97C2",
    marginRatiosModule: "0x04CB11575E290C482aFfbfD6b651Fd23bc54CA73",
    priceImpactModule: "0x905C819466DE72891a7a9A9Bd6869D847DbE1204",
  },
  /** Arbitrum Sepolia (chain id 421614). */
  arbitrumSepolia: {
    usdc: "0xBEF280BefeE2Cb28c20D1E4Cc1da999B4DA0f1fD",
    perpFactory: "0xFD7491670e03c522078448d87411091c23b757Fb",
    perpGuardHook: "0x9FCBEc9019d37780A0c21573cC4F556691252aA0",
    protocolFeeManager: "0xef5c8D457c4a40c58A3Cfb4CF08F9Ed96Af023c7",
    moduleRegistry: "0x21Ba854199798F0CBAde0FF60E4e8A92FfBD9230",
    pricingModule: "0xBB679a4c15Dd4e8eC8016FA7FE42097017cbA11E",
    fundingModule: "0xa92aB4E82B0d571e1A0DF18c583232688B196477",
    feesModule: "0x8BB0812C621A427FfD0B0686a64006Ab9dba9c2a",
    marginRatiosModule: "0x48dfbffA972A000e13b900AD131B6E5Bc40CE5Bd",
    priceImpactModule: "0xFc66d25a5AFe713F42703C4feF2029E3De2616AB",
  },
} as const satisfies Record<string, Required<Omit<PerpCityDeployments, "perpAddress">>>;

/** v1.0.0 beacon factories (lib/beacons f762da1) used to create v1 market beacons. */
export const V1_BEACON_DEPLOYMENTS = {
  arbitrum: {
    identityBeaconFactory: "0xd94B1dA2A425bdDb82D7da9914fdF6B44Fc17184",
    ecdsaVerifierFactory: "0xdD904f48848cB4D233c14d7A55718535ED825dC1",
  },
  arbitrumSepolia: {
    identityBeaconFactory: "0x25b1306CADe5861eF38B216DD3CA2E80C986Bd84",
    ecdsaVerifierFactory: "0x1e033361E33fa25D276DecCB01EF9C7b256C2085",
  },
} as const;
