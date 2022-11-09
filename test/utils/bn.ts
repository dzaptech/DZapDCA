import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import { parseUnits } from 'ethers/lib/utils'
import { BASE_TEN, TOKEN_A_DECIMAL, TOKEN_B_DECIMAL, TOKEN_C_DECIMAL, TOKEN_D_DECIMAL, USDT_DECIMAL } from './constant'

/* ----------------------------------------- */
/* Big Number Helpers */
// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: string | number, decimals = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
}

export function convertBNToNegative(amount: BigNumber) {
  return BigNumber.from(0).sub(amount)
}

export const calBNPercent = (num: BigNumber, percentage: number) => {
  return num.mul(percentage).div(100)
}

export const bigNumberMin = (a: BigNumber, b: BigNumber) => {
  return a.lt(b) ? a : b
}

export const bigNumberMax = (a: BigNumber, b: BigNumber) => {
  return a.gt(b) ? a : b
}

export function toWei(amount: number) {
  return ethers.utils.parseEther(amount.toString())
}

export const bnCloseTo = (value: BigNumber, expectedValue: BigNumber, closeTo: number | BigNumber) => {
  if (value.gte(expectedValue) && value.lte(expectedValue.add(closeTo))) return true
  if (value.lte(expectedValue) && value.gte(expectedValue.sub(closeTo))) return true

  return false
}

export function bnSqrt(x: BigNumber) {
  const ONE = BigNumber.from(1)
  const TWO = BigNumber.from(2)

  let z = x.add(ONE).div(TWO)
  let y = x
  while (z.sub(y).isNegative()) {
    y = z
    z = x.div(z).add(z).div(TWO)
  }
  return y
}

export const bnConsoleLog = (a: string, b: BigNumber) => {
  console.log(a, b.toString())
}

export const parseTokenA = (value: BigNumberish) => {
  return parseUnits(value.toString(), TOKEN_A_DECIMAL)
}

export const parseTokenB = (value: BigNumberish) => {
  return parseUnits(value.toString(), TOKEN_B_DECIMAL)
}

export const parseTokenC = (value: BigNumberish) => {
  return parseUnits(value.toString(), TOKEN_C_DECIMAL)
}

export const parseTokenD = (value: BigNumberish) => {
  return parseUnits(value.toString(), TOKEN_D_DECIMAL)
}

export const parseUSDT = (value: BigNumberish) => {
  return parseUnits(value.toString(), USDT_DECIMAL)
}

/* ----------------------------------------- */

// export const getLatestCreatedEvent = async (
//   factory: GatherLaunchpadFactory
// ) => {
//   const eventFilter = factory.filters.Created();
//   const data = await factory.queryFilter(eventFilter);
//   return data[data.length - 1].args;
// };

/* ----------------------------------------- */
