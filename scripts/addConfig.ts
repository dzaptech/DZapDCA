import { ethers } from 'hardhat'
import { CONTRACTS, networks, SwapIntervals } from '../common'
import { ChainlinkOracle, DZapDCA } from '../typechain'

async function main() {
  const { chainId } = await ethers.provider.getNetwork()
  const networkName: string = networks[chainId]
  const [governor] = await ethers.getSigners()

  console.log(`Deploying with account ${governor.address} on ${networkName}`)
  console.log('Account balance deployer:', (await governor.getBalance()).toString())

  /* ------------------------------------------- */

  const dcaAddress = ''
  const oracleAddress = ''

  /* ------------------------------------------- */

  const dZap = (await ethers.getContractAt(CONTRACTS.DZapDCA, dcaAddress)) as DZapDCA
  const oracle = (await ethers.getContractAt(CONTRACTS.ChainlinkOracle, oracleAddress)) as ChainlinkOracle

  await dZap
    .connect(governor)
    .addSwapIntervalsToAllowedList([
      SwapIntervals.OneHour,
      SwapIntervals.OneDay,
      SwapIntervals.OneWeek,
      SwapIntervals.OneMonth,
    ])

  // await dZap.connect(governor).addAllowedTokens([])

  await oracle.connect(governor).addFeedMapping([], [])

  /* ------------------------------------------- */
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
