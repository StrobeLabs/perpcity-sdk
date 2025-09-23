import { PerpCityDeployments } from './types';

export const DEPLOYMENTS: {[chainId: number]: PerpCityDeployments} = {
  // Base Sepolia
  [84532]: {
    perpManager: '0x6805b036F0CcDE99503a40E302EAE0478A1Bc000',
    usdc: '0x4200000000000000000000000000000000000006',
    goldsky: 'https://api.goldsky.com/api/public/project_cmbawn40q70fj01ws4jmsfj7f/subgraphs/perp-city/3fe61683-20250915_170731/gn',
  },
}