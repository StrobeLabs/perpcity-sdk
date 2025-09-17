import type { PublicClient, WalletClient, Abi, Address} from "viem";
import { GraphQLClient } from 'graphql-request'

export type PerpCityContextConfig = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  goldskyEndpoint: string;
  perpManagerAddress: Address;
  perpManagerAbi: Abi;
  beaconAbi: Abi;
}

export class PerpCityContext {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient;
  // below will be hard-coded in addresses.ts, abis.ts, and endpoints.ts once they are frozen
  // they are currently being rapidly redeployed so can be specified by the sdk consumer for now
  public readonly goldskyClient: GraphQLClient;
  public readonly perpManagerAddress: Address;
  public readonly perpManagerAbi: Abi;
  public readonly beaconAbi: Abi;

  constructor(config: PerpCityContextConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.goldskyClient = new GraphQLClient(config.goldskyEndpoint);
    this.perpManagerAddress = config.perpManagerAddress;
    this.perpManagerAbi = config.perpManagerAbi;
    this.beaconAbi = config.beaconAbi;
  }
}