// assume this react file is inside a frontend repo
// app/layout.tsx or pages/_app.tsx
import { PerpCityProvider } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';
import { 
  GOLDSKY_BASE_SEPOLIA_URL,
  PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
  PERP_MANAGER_ABI,
  BEACON_ABI
} from '@strobelabs/perpcity-sdk';

// For Next.js App Router (app/layout.tsx)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PerpCityProvider config={getPerpCityConfig()}>
          {children}
        </PerpCityProvider>
      </body>
    </html>
  );
}

// For Next.js Pages Router (pages/_app.tsx)
export default function MyApp({ Component, pageProps }: any) {
  return (
    <PerpCityProvider config={getPerpCityConfig()}>
      <Component {...pageProps} />
    </PerpCityProvider>
  );
}

function getPerpCityConfig() {
  // In a real app, you'd get these from environment variables or user wallet connection
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL!),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  });

  return {
    walletClient,
    goldskyEndpoint: GOLDSKY_BASE_SEPOLIA_URL,
    perpManagerAddress: PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
    perpManagerAbi: PERP_MANAGER_ABI,
    beaconAbi: BEACON_ABI
  };
}
