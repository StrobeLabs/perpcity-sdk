import type { PublicClient, WalletClient, Abi, Address} from "viem";

export type PerpCityContext = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  // below will be hard-coded in addresses.ts, abis.ts, and endpoints.ts once they are frozen
  // they are currently being rapidly redeployed so can be specified by the sdk consumer for now
  addresses: {
    perpManager: Address;
  };
  abis: {
    perpManager: Abi;
    beacon: Abi;
  };
  endpoints: {
    goldsky: URL;
  };
};