export const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
export const tokenAddress = {
  1: {
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    aave: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    wNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  137: {
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    dai: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    aave: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    wEth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    wNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    sand: '0xbbba073c31bf03b8acf7c28ef0738decf3695683',
  },
  56: {
    wNative: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  },
  42161: {
    wNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
}

export const routers = {
  1: {
    oneInch: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    uniSwap: {
      router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      fee: 0.3,
    },
    sushiSwap: {
      router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      fee: 0.3,
    },
  },
  137: {
    oneInch: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    quickSwap: {
      router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      factory: '0x5757371414417b8c6caad45baef941abc7d3ab32',
      fee: 0.3,
    },
    sushiSwap: {
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      fee: 0.3,
    },
  },
  56: {
    oneInch: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    pancakeSwap: {
      router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      fee: 0.25,
    },
  },
  42161: {
    oneInch: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    sushiSwap: {
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      fee: 0.3,
    },
  },
}
