import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    worldchain_testnet: {
      url: 'https://worldchain-sepolia.g.alchemy.com/v2/' + (process.env.ALCHEMY_KEY || ''),
      accounts: process.env.BACKEND_WALLET_PRIVATE_KEY ? [process.env.BACKEND_WALLET_PRIVATE_KEY] : [],
      chainId: 4801,
    },
    worldchain: {
      url: 'https://worldchain-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_KEY || ''),
      accounts: process.env.BACKEND_WALLET_PRIVATE_KEY ? [process.env.BACKEND_WALLET_PRIVATE_KEY] : [],
      chainId: 480,
    },
  },
  etherscan: {
    apiKey: {
      worldchain: process.env.WORLDSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'worldchain',
        chainId: 480,
        urls: {
          apiURL: 'https://api.worldscan.org/api',
          browserURL: 'https://worldscan.org',
        },
      },
    ],
  },
};

export default config;
