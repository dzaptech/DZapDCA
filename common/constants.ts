import { BigNumber } from 'ethers'

export const ZERO = BigNumber.from(0)
export const BPS_MULTIPLIER = 100
export const CONTRACTS = {
  DZapDCA: 'DZapDCA',
  DCAMock: 'DCAMock',
  MockExchange: 'MockExchange',
  AggregationRouterV4: 'AggregationRouterV4',
  UniswapV2Factory: 'UniswapV2Factory',
  UniswapV2Router02: 'UniswapV2Router02',
  UniswapV2Pair: 'UniswapV2Pair',
  WNATIVE: 'WNATIVE',
  ERC20Mock: 'ERC20Mock',
  ERC20: 'ERC20',
  ERC721Mock: 'ERC721Mock',
  Dai: 'Dai',
}

export const EVENTS = {
  Paused: 'Paused',
  Unpaused: 'Unpaused',
  TokensAllowedUpdated: 'TokensAllowedUpdated',
  SwapIntervalsUpdated: 'SwapIntervalsUpdated',
  FeeVaultUpdated: 'FeeVaultUpdated',
  SwapFeeUpdated: 'SwapFeeUpdated',
  PlatformFeeRatioUpdated: 'PlatformFeeRatioUpdated',
  Deposited: 'Deposited',
  Withdrew: 'Withdrew',
  WithdrewManyFromMultiplePositions: 'WithdrewManyFromMultiplePositions',
  WithdrewAndSwapped: 'WithdrewAndSwapped',
  Modified: 'Modified',
  Terminated: 'Terminated',
  Swapped: 'Swapped',
}

export const ONE_INCH_BASE_URL = 'https://api.1inch.io/v4.0'

export const dummyKey = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const dummyApiKey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
