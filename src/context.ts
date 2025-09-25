import { GraphQLClient } from 'graphql-request'
import { DEPLOYMENTS } from "./deployments";
import { publicActions } from "viem";
import { PerpCityContextConfig, PerpCityDeployments } from "./types";

export class PerpCityContext {
  public readonly walletClient;
  public readonly goldskyClient: GraphQLClient;

  constructor(config: PerpCityContextConfig) {
    this.walletClient = config.walletClient.extend(publicActions);

    const chainId = this.validateChainId();
    const deployments = DEPLOYMENTS[chainId];

    const headers: Record<string, string> = {};
    let goldskyEndpoint: string;
    
    if (config.goldskyBearerToken) {
      headers.authorization = `Bearer ${config.goldskyBearerToken}`;
      goldskyEndpoint = deployments.goldskyPrivate;
    } else {
      goldskyEndpoint = deployments.goldskyPublic;
    }
    
    this.goldskyClient = new GraphQLClient(goldskyEndpoint, {
      headers,
    });
  }

  validateChainId(): number {
    const chainId = this.walletClient.chain?.id;

    if (!chainId) throw new Error(`Chain ID is not set.`);
    if (!DEPLOYMENTS[chainId]) throw new Error(`Unsupported chainId: ${chainId}.`);

    return chainId;
  }

  deployments(): PerpCityDeployments {
    return DEPLOYMENTS[this.validateChainId()];
  }
}