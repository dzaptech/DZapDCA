import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import { ZERO } from '../common/constant'

export async function advanceBlock() {
  return ethers.provider.send('evm_mine', [])
}

export async function advanceBlockTo(blockNumber: number) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

export async function advanceBlockBy(number: number) {
  for (let i = 0; i < number; i++) {
    await advanceBlock()
  }
}

export async function increase(value: number) {
  await ethers.provider.send('evm_increaseTime', [value])
  await advanceBlock()
}

export async function increaseTo(target: BigNumberish) {
  let targetBn: BigNumber = ZERO
  if (!BigNumber.isBigNumber(duration)) {
    targetBn = BigNumber.from(duration)
  }
  const now = await latest()
  if (targetBn.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${targetBn})`)
  const diff = targetBn.sub(now).toNumber()
  return increase(diff)
}

export async function latest() {
  const block = await ethers.provider.getBlock('latest')
  return BigNumber.from(block.timestamp)
}

export async function latestBlock() {
  return BigNumber.from(await ethers.provider.getBlockNumber())
}

export async function advanceTimeAndBlock(time: number | BigNumber) {
  await advanceTime(time)
  await advanceBlock()
}

export async function advanceTime(time: number | BigNumber) {
  if (typeof time !== 'number') time = time.toNumber()
  await ethers.provider.send('evm_increaseTime', [time])
}

export const duration = {
  seconds: function (val: number | string) {
    return BigNumber.from(val)
  },
  minutes: function (val: number | string) {
    return BigNumber.from(val).mul(this.seconds('60'))
  },
  hours: function (val: number | string) {
    return BigNumber.from(val).mul(this.minutes('60'))
  },
  days: function (val: number | string) {
    return BigNumber.from(val).mul(this.hours('24'))
  },
  weeks: function (val: number | string) {
    return BigNumber.from(val).mul(this.days('7'))
  },
  month: (val: number | string = 1) => duration.days(30).mul(BigNumber.from(val)),
  years: function (val: number | string) {
    return BigNumber.from(val).mul(this.days('365'))
  },
}
