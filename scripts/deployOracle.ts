import { ethers } from 'hardhat'
import { CONTRACTS, networks } from '../common'

async function main() {
  const { chainId } = await ethers.provider.getNetwork()
  const networkName: string = networks[chainId]
  const [deployer] = await ethers.getSigners()

  console.log(`Deploying with account ${deployer.address} on ${networkName}`)
  console.log('Account balance deployer:', (await deployer.getBalance()).toString())

  /* ------------------------------------------- */

  const governor = ''
  const maxDelay = 1 * 60 // 60 sec

  /* ------------------------------------------- */

  const Oracle = await ethers.getContractFactory(CONTRACTS.ChainlinkOracle)
  const oracle = await Oracle.connect(deployer).deploy(governor, maxDelay)

  console.log('oracle', oracle.address)

  /* ------------------------------------------- */
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
