export const ORACLE_SLIPPAGE = 100 // 1%

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

export enum SwapIntervalsBytes {
  OneHour = '0x01',
  FourHour = '0x02',
  TwelveHour = '0x04',
  OneDay = '0x08',
  ThreeDay = '0x10',
  OneWeek = '0x20',
  TwoWeek = '0x40',
  OneMonth = '0x80',
}

export const testAccount = '0x14ddB015605743ba12716Cf525992ED38e14a4b0'
