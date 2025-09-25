import { PerpCityDeployments } from './types';

export const DEPLOYMENTS: {[chainId: number]: PerpCityDeployments} = {
  // Base Sepolia
  [84532]: {
    perpManager: '0x59F1766b77fd67af6c80217C2025A0D536998000',
    usdc: '0xC1a5D4E99BB224713dd179eA9CA2Fa6600706210',
    goldskyPublic: 'https://api.goldsky.com/api/public/project_cmbawn40q70fj01ws4jmsfj7f/subgraphs/perp-city/36ac28e6-20250925_150813/gn',
    goldskyPrivate: 'https://api.goldsky.com/api/private/project_cmbawn40q70fj01ws4jmsfj7f/subgraphs/perp-city/36ac28e6-20250925_150813/gn',
  },
}