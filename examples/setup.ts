import 'dotenv/config';
import { PerpCityContext, PerpManager, DEPLOYMENTS} from "../dist";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';

export function setup() : PerpManager {
  if (!process.env['RPC_URL']) {
    throw new Error(`Missing required env var: RPC_URL`);
  }
  if (!process.env['PRIVATE_KEY']) {
    throw new Error(`Missing required env var: PRIVATE_KEY`);
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  })

  const ctx = new PerpCityContext({
    walletClient: walletClient,
    goldskyEndpoint: DEPLOYMENTS[baseSepolia.id].goldsky,
  });

  return new PerpManager(ctx);
}