import { BigNumber } from 'ethers'

export const ZERO = BigNumber.from(0)
export const BPS_MULTIPLIER = 100
export const CONTRACTS = {
  DZapDCA: 'DZapDCA',
  ChainlinkOracle: 'ChainlinkOracle',
  DCAMock: 'DCAMock',
  MockExchange: 'MockExchange',
  MockOracle: 'MockOracle',
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
  OracleUpdated: 'OracleUpdated',
  SlippageUpdated: 'SlippageUpdated',
  Created: 'Created',
  Withdrew: 'Withdrew',
  Modified: 'Modified',
  Terminated: 'Terminated',
}

export enum SwapIntervals {
  OneHour = 60 * 60,
  FourHour = 4 * 60 * 60,
  TwelveHour = 12 * 60 * 60,
  OneDay = 24 * 60 * 60,
  ThreeDay = 3 * 24 * 60 * 60,
  OneWeek = 7 * 24 * 60 * 60,
  TwoWeek = 14 * 24 * 60 * 60,
  OneMonth = 30 * 24 * 60 * 60,
}

export const ONE_INCH_BASE_URL = 'https://api.1inch.io/v4.0'

export const dummyKey = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const dummyApiKey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
