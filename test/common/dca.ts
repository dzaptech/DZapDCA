import { BPS_DENOMINATOR } from '../utils'

export const calculateAmountAndFee = (amount, swapFee, platformFee) => {
  const feeAmount = amount.mul(swapFee).div(BPS_DENOMINATOR)
  const swapAmount = amount.sub(feeAmount)

  const platformFeeAmount = feeAmount.mul(platformFee).div(BPS_DENOMINATOR)
  const swapReward = feeAmount.sub(platformFeeAmount)

  return { swapAmount, swapReward, platformFeeAmount }
}

export const calSwapped = (rate, swapFee, magnitudeA, magnitudeB, price) => {
  return rate.sub(rate.mul(swapFee).div(BPS_DENOMINATOR)).mul(magnitudeB).div(magnitudeA).mul(price).div(1000)
}

export const calAmount = (value, percent) => {
  return value.sub(value.mul(percent).div(BPS_DENOMINATOR))
}
