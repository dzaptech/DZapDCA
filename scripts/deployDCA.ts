import { ethers } from 'hardhat'
import { BPS_MULTIPLIER, CONTRACTS, networks } from '../common'
import { routers, tokenAddress } from '../common/registry'

async function main() {
  const { chainId } = await ethers.provider.getNetwork()
  const networkName: string = networks[chainId]
  const [deployer] = await ethers.getSigners()

  console.log(`Deploying with account ${deployer.address} on ${networkName}`)
  console.log('Account balance deployer:', (await deployer.getBalance()).toString())

  /* ------------------------------------------- */

  const governor = ''
  const feeVault = ''

  const oracle = ''
  const wNativeToken = tokenAddress[chainId].wNative
  const oneInchRouter = routers[chainId].oneInch

  const slippage = 1 * BPS_MULTIPLIER

  /* ------------------------------------------- */

  const DZap = await ethers.getContractFactory(CONTRACTS.DZapDCA)
  const dca = await DZap.connect(deployer).deploy(governor, wNativeToken, oneInchRouter, oracle, feeVault, slippage)

  console.log('dca', dca.address)

  /* ------------------------------------------- */
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
