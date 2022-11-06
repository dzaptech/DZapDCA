/* eslint-disable no-unused-vars */
type Networks =
  | 'hardhat'
  | 'mainnet'
  | 'bscMainnet'
  | 'polygonMainnet'
  | 'arbitrum'
  | 'rinkeby'
  | 'bscTestnet'
  | 'polygonTestnet'

export const NETWORKS: { [key in Networks]: string } = {
  hardhat: 'hardhat',
  mainnet: 'mainnet',
  bscMainnet: 'bscMainnet',
  polygonMainnet: 'polygonMainnet',
  arbitrum: 'arbitrum',
  rinkeby: 'rinkeby',
  bscTestnet: 'bscTestnet',
  polygonTestnet: 'polygonTestnet',
}

export const nodeUrls: { [key in Networks]: string } = {
  hardhat: '',
  mainnet: 'https://mainnet.infura.io/v3',
  bscMainnet: 'https://bsc-dataseed.binance.org',
  polygonMainnet: 'https://polygon-mainnet.g.alchemy.com/v2',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2',
  rinkeby: 'https://rinkeby.infura.io/v3',
  bscTestnet: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  polygonTestnet: 'https://polygon-mumbai.g.alchemy.com/v2',
}

export const chainIds: { [key in Networks]: number } = {
  hardhat: 31337,
  mainnet: 1,
  bscMainnet: 56,
  polygonMainnet: 137,
  arbitrum: 42161,
  rinkeby: 4,
  bscTestnet: 97,
  polygonTestnet: 80001,
}

export const networks: { [key: number]: Networks } = {
  31337: 'hardhat',
  1: 'mainnet',
  56: 'bscMainnet',
  137: 'polygonMainnet',
  42161: 'arbitrum',
  4: 'rinkeby',
  97: 'bscTestnet',
  80001: 'polygonTestnet',
}
