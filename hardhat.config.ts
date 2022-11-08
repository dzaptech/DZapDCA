import * as dotenv from 'dotenv'

import { HardhatUserConfig } from 'hardhat/config'
import { chainIds, dummyKey, dummyApiKey, NETWORKS } from './common'

import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'hardhat-contract-sizer'
import 'solidity-coverage'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-abi-exporter'

import './tasks/accounts'
import './tasks/clean'
import { getNodeUrl } from './utils/network'

dotenv.config()

const mainnetKey: string = process.env.MAINNET_KEY || dummyKey
const testnetKey: string = process.env.TESTNET_KEY || dummyKey
const infuraApiKey: string = process.env.INFURA_API_KEY || dummyApiKey
const alchemyApiKey: string = process.env.ALCHEMY_API_KEY || dummyApiKey

const config: HardhatUserConfig = {
  defaultNetwork: NETWORKS.hardhat,
  networks: {
    mainnet: {
      chainId: chainIds.mainnet,
      url: getNodeUrl(NETWORKS.mainnet, infuraApiKey),
      accounts: [mainnetKey],
    },
    bscMainnet: {
      chainId: chainIds.bscMainnet,
      url: getNodeUrl(NETWORKS.bscMainnet),
      accounts: [mainnetKey],
    },
    polygonMainnet: {
      chainId: chainIds.polygonMainnet,
      url: getNodeUrl(NETWORKS.polygonMainnet, alchemyApiKey),
      accounts: [mainnetKey],
      timeout: 4000000,
    },
    arbitrum: {
      chainId: chainIds.arbitrum,
      url: getNodeUrl(NETWORKS.arbitrum, alchemyApiKey),
      accounts: [testnetKey],
    },
    rinkeby: {
      url: getNodeUrl(NETWORKS.rinkeby, infuraApiKey),
      chainId: chainIds.rinkeby,
      accounts: [testnetKey],
    },
    bscTestnet: {
      url: getNodeUrl(NETWORKS.bscTestnet),
      chainId: chainIds.bscTestnet,
      accounts: [testnetKey],
    },
    polygonTestnet: {
      url: getNodeUrl(NETWORKS.polygonTestnet, alchemyApiKey),
      chainId: chainIds.polygonTestnet,
      accounts: [testnetKey],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 300,
          },
          // viaIR: true,
        },
      },
      {
        version: '0.7.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.4.18',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 21,
  },
  mocha: {
    timeout: 400000,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || dummyApiKey,
      polygon: process.env.POLYGONSCAN_API_KEY || dummyApiKey,
      bsc: process.env.BSCSCAN_API_KEY || dummyApiKey,
      arbitrumOne: process.env.ARBITRUM_API_KEY || dummyApiKey,
    },
  },
  abiExporter: [
    {
      runOnCompile: true,
      path: 'data/abi/full',
      only: ['DZapAggregator.sol', 'DZapDiscountNft.sol'],
      flat: true,
      clear: true,
    },
    {
      runOnCompile: true,
      path: 'data/abi/pretty',
      format: 'fullName',
      only: ['DZapAggregator.sol', 'DZapDiscountNft.sol'],
      flat: true,
      clear: true,
    },
  ],
  typechain: {
    outDir: 'typechain',
  },
}

export default config
