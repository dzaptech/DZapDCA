import axios from 'axios'
import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'

import { CONTRACTS } from '../../common'
import { NATIVE } from '../../common/registry'

import { ADDRESS_ZERO, BPS_DENOMINATOR, ZERO } from '../utils'

import { SwapParams } from '../../types'

const BASE_URL = 'https://api.1inch.io/v4.0'

export const generateSwapDetails = async (chainId: number, swapParams: SwapParams[]) => {
  try {
    const apis = swapParams.map((param) => {
      let paramsString = ''
      for (const key in param) {
        paramsString += `${key}=${param[key]}&`
      }

      const url = `${BASE_URL}/${chainId}/swap?${paramsString}`.slice(0, -1)

      return axios.get(url)
    })

    const response = await axios.all(apis)

    const OneInchRouter = await ethers.getContractFactory(CONTRACTS.AggregationRouterV4)

    return response.map(({ data }) => OneInchRouter.interface.decodeFunctionData('swap', data.tx.data))
  } catch (err: any) {
    console.log(err)

    throw new Error(
      `Status code: ${err.response.status}. Message: ${err.response.statusText} (${err.response.data.description})`
    )
  }
}

export const getSwapDetails = async (chainId: number, swapParams: SwapParams[], permits?: string[]) => {
  const details = await generateSwapDetails(chainId, swapParams)
  let value = ZERO

  const swapDetails = details.map((decodedData, i) => {
    if (decodedData.desc.srcToken === NATIVE || decodedData.desc.srcToken === ADDRESS_ZERO) {
      value = value.add(decodedData.desc.amount)
    }

    return {
      executor: decodedData.caller,
      desc: decodedData.desc,
      routeData: decodedData.data,
      permit: permits && permits[i] ? permits[i] : '0x',
    }
  })
  return { swapDetails, value }
}

export const getMinReturnAmount = (amountOut: BigNumber, feeBps = ZERO) => {
  const fee = amountOut.mul(feeBps).div(BPS_DENOMINATOR)
  return amountOut.sub(fee).toString()
}

export const decodeData = async (data: string) => {
  const OneInchRouter = await ethers.getContractFactory(CONTRACTS.AggregationRouterV4)
  const iface = OneInchRouter.interface
  // const iface = new ethers.utils.Interface(CONTRACTS.AggregationRouterV4);
  return iface.decodeFunctionData('swap', data)
}

export const calFeeAmount = (amounts: BigNumber[], fee: BigNumberish) => {
  return amounts.map((amount) => {
    const feeAmount = amount.mul(fee).div(BPS_DENOMINATOR)

    return { amount: amount.sub(feeAmount), fee: feeAmount }
  })
}
