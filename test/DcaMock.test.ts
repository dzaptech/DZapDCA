import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, ContractFactory } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

import { CONTRACTS, EVENTS, ZERO } from '../common'

import {
  ADDRESS_ZERO,
  advanceTimeAndBlock,
  BPS_MULTIPLIER,
  DUMMY_ADDRESS,
  duration,
  generatePermitCalldata,
  hexToBinary,
  impersonate,
  latest,
  NATIVE_ADDRESS,
  parseTokenA,
  parseTokenB,
  parseTokenC,
  parseTokenD,
  TOKEN_A_DECIMAL,
  TOKEN_B_DECIMAL,
  TOKEN_C_DECIMAL,
  TOKEN_D_DECIMAL,
  updateBalance,
  ZERO_ADDRESS,
} from './utils'

import { DCAMock, ERC20Mock, MockExchange, MockOracle, WNATIVE } from '../typechain'
import {
  calAmount,
  calculateAmountAndFee,
  calSwapped,
  ORACLE_SLIPPAGE,
  SwapIntervals,
  SwapIntervalsBytes,
  testAccount,
} from './common'

let DCAArtifact: ContractFactory
let ERC20Artifact: ContractFactory
let MockExchangeArtifact: ContractFactory
let MockOracleArtifact: ContractFactory
let WNativeArtifact: ContractFactory

let dca: DCAMock
let mockExchange: MockExchange
let mockOracle: MockOracle
let tokenA: ERC20Mock
let tokenB: ERC20Mock
let tokenC: ERC20Mock
let tokenD: ERC20Mock

let signers: SignerWithAddress[]
let deployer: SignerWithAddress
let governor: SignerWithAddress
let feeVault: SignerWithAddress

let wNative: WNATIVE

describe('DCAMock.test.ts', () => {
  before(async () => {
    /* ------------------------------ */
    // get signers
    signers = await ethers.getSigners()
    deployer = signers[9]
    governor = signers[10]
    feeVault = signers[11]

    /* ------------------------------ */
    // get artifacts
    DCAArtifact = await ethers.getContractFactory(CONTRACTS.DCAMock)
    ERC20Artifact = await ethers.getContractFactory(CONTRACTS.ERC20Mock)
    WNativeArtifact = await ethers.getContractFactory(CONTRACTS.WNATIVE)
    MockExchangeArtifact = await ethers.getContractFactory(CONTRACTS.MockExchange)
    MockOracleArtifact = await ethers.getContractFactory(CONTRACTS.MockOracle)

    /* ------------------------------ */
    // contract deployment

    tokenA = (await ERC20Artifact.connect(deployer).deploy(
      'MTokenA',
      'MA',
      TOKEN_A_DECIMAL,
      parseUnits('10000', TOKEN_A_DECIMAL)
    )) as ERC20Mock

    tokenB = (await ERC20Artifact.connect(deployer).deploy(
      'MTokenB',
      'MB',
      TOKEN_B_DECIMAL,
      parseUnits('10000', TOKEN_B_DECIMAL)
    )) as ERC20Mock

    tokenC = (await ERC20Artifact.connect(deployer).deploy(
      'MTokenC',
      'MC',
      TOKEN_C_DECIMAL,
      parseUnits('10000', TOKEN_C_DECIMAL)
    )) as ERC20Mock

    tokenD = (await ERC20Artifact.connect(deployer).deploy(
      'MTokenD',
      'MC',
      TOKEN_D_DECIMAL,
      parseUnits('10000', TOKEN_D_DECIMAL)
    )) as ERC20Mock

    wNative = (await WNativeArtifact.connect(deployer).deploy()) as WNATIVE

    signers.forEach(async (signer: SignerWithAddress) => {
      await tokenA.connect(deployer).mint(signer.address, parseTokenA(10000))
      await tokenB.connect(deployer).mint(signer.address, parseTokenB(10000))
      await tokenC.connect(deployer).mint(signer.address, parseTokenC(10000))
      await tokenD.connect(deployer).mint(signer.address, parseTokenD(10000))
    })
  })

  beforeEach(async () => {
    mockExchange = (await MockExchangeArtifact.connect(deployer).deploy()) as MockExchange

    mockOracle = (await MockOracleArtifact.connect(deployer).deploy(
      governor.address,
      duration.minutes(1)
    )) as MockOracle

    dca = (await DCAArtifact.connect(deployer).deploy(
      governor.address,
      wNative.address,
      DUMMY_ADDRESS,
      mockOracle.address,
      mockExchange.address,
      feeVault.address,
      ORACLE_SLIPPAGE
    )) as DCAMock

    signers.forEach(async (signer: SignerWithAddress) => {
      await tokenA.connect(deployer).mint(signer.address, parseTokenA(10000))
      await tokenB.connect(deployer).mint(signer.address, parseTokenB(10000))
      await tokenC.connect(deployer).mint(signer.address, parseTokenC(10000))
      await tokenD.connect(deployer).mint(signer.address, parseTokenD(10000))
    })
  })

  describe('(1) Initialization', () => {
    it('1.1 Should deploy contract successfully', async () => {
      expect(await dca.governance()).equal(governor.address)
      expect(await dca.wNative()).equal(wNative.address)
      expect(await dca.ONE_INCH_ROUTER()).equal(DUMMY_ADDRESS)
      expect(await dca.mockExchange()).equal(mockExchange.address)
      expect(await dca.oracle()).equal(mockOracle.address)
      expect(await dca.feeVault()).equal(feeVault.address)
      expect(await dca.slippage()).equal(ORACLE_SLIPPAGE)
    })
  })

  describe('(2) DCA Config Handler', () => {
    describe('Transaction Successful', () => {
      it('2.1 Should allow governor to pause the contract', async () => {
        expect(await dca.paused()).equal(false)

        await expect(dca.connect(governor).pause()).emit(dca, EVENTS.Paused)

        expect(await dca.paused()).equal(true)
      })

      it('2.2 Should allow governor to unpause the contract', async () => {
        await dca.connect(governor).pause()

        expect(await dca.paused()).equal(true)

        await expect(dca.connect(governor).unpause()).emit(dca, EVENTS.Unpaused)

        expect(await dca.paused()).equal(false)
      })

      it('2.3 Should allow governor to add tokens', async () => {
        expect(await dca.allowedTokens(tokenA.address)).equal(false)
        expect(await dca.allowedTokens(tokenB.address)).equal(false)
        expect(await dca.tokenMagnitude(tokenA.address)).equal(ZERO)
        expect(await dca.tokenMagnitude(tokenB.address)).equal(ZERO)

        await expect(dca.connect(governor).addAllowedTokens([tokenA.address, tokenB.address]))
          .emit(dca, EVENTS.TokensAllowedUpdated)
          .withArgs([tokenA.address, tokenB.address], true)

        expect(await dca.allowedTokens(tokenA.address)).equal(true)
        expect(await dca.allowedTokens(tokenB.address)).equal(true)
        expect(await dca.tokenMagnitude(tokenA.address)).equal(ethers.utils.parseUnits('1', TOKEN_A_DECIMAL))
        expect(await dca.tokenMagnitude(tokenB.address)).equal(ethers.utils.parseUnits('1', TOKEN_B_DECIMAL))
      })

      it('2.4 Should allow governor to remove tokens', async () => {
        await dca.connect(governor).addAllowedTokens([tokenA.address, tokenB.address])

        expect(await dca.allowedTokens(tokenA.address)).equal(true)
        expect(await dca.allowedTokens(tokenB.address)).equal(true)

        await expect(dca.connect(governor).removeAllowedTokens([tokenA.address, tokenB.address]))
          .emit(dca, EVENTS.TokensAllowedUpdated)
          .withArgs([tokenA.address, tokenB.address], false)

        expect(await dca.allowedTokens(tokenA.address)).equal(false)
        expect(await dca.allowedTokens(tokenB.address)).equal(false)
        expect(await dca.tokenMagnitude(tokenA.address)).equal(ethers.utils.parseUnits('1', TOKEN_A_DECIMAL))
        expect(await dca.tokenMagnitude(tokenB.address)).equal(ethers.utils.parseUnits('1', TOKEN_B_DECIMAL))
      })

      it('2.5 Should allow governor to add swap intervals', async () => {
        expect(hexToBinary(await dca.allowedSwapIntervals())).equal('00000000')

        const intervals = [SwapIntervals.FourHour, SwapIntervals.OneDay, SwapIntervals.TwoWeek]

        await expect(dca.connect(governor).addSwapIntervalsToAllowedList(intervals))
          .emit(dca, EVENTS.SwapIntervalsUpdated)
          .withArgs(intervals, true)

        expect(hexToBinary(await dca.allowedSwapIntervals())).equal('01001010')
      })

      it('2.6 Should allow governor to remove swap intervals', async () => {
        await dca
          .connect(governor)
          .addSwapIntervalsToAllowedList([SwapIntervals.FourHour, SwapIntervals.OneDay, SwapIntervals.TwoWeek])

        expect(hexToBinary(await dca.allowedSwapIntervals())).equal('01001010')

        await expect(dca.connect(governor).removeSwapIntervalsFromAllowedList([SwapIntervals.OneDay]))
          .emit(dca, EVENTS.SwapIntervalsUpdated)
          .withArgs([SwapIntervals.OneDay], false)

        expect(hexToBinary(await dca.allowedSwapIntervals())).equal('01000010')
      })

      it('2.7 Should allow governor to set feeVault', async () => {
        expect(await dca.feeVault()).equal(feeVault.address)

        const newFeeVault = signers[18].address

        await expect(dca.connect(governor).setFeeVault(newFeeVault))
          .emit(dca, EVENTS.FeeVaultUpdated)
          .withArgs(newFeeVault)

        expect(await dca.feeVault()).equal(newFeeVault)
      })

      it('2.8 Should allow governor to set swapFee', async () => {
        expect(await dca.swapFee()).equal(ZERO)

        const fee = 5 * BPS_MULTIPLIER

        await expect(dca.connect(governor).setSwapFee(fee)).emit(dca, EVENTS.SwapFeeUpdated).withArgs(fee)

        expect(await dca.swapFee()).equal(fee)
      })

      it('2.9 Should allow governor to set platformFee', async () => {
        expect(await dca.swapFee()).equal(ZERO)

        const fee = 20 * BPS_MULTIPLIER

        await expect(dca.connect(governor).setPlatformFeeRatio(fee))
          .emit(dca, EVENTS.PlatformFeeRatioUpdated)
          .withArgs(fee)

        expect(await dca.platformFeeRatio()).equal(fee)
      })

      it('2.10 Should allow governor to set oracle', async () => {
        const newMockOracle = (await MockOracleArtifact.connect(deployer).deploy(
          governor.address,
          duration.minutes(1)
        )) as MockOracle

        expect(await dca.oracle()).equal(mockOracle.address)

        await expect(dca.connect(governor).setOracle(newMockOracle.address))
          .emit(dca, EVENTS.OracleUpdated)
          .withArgs(newMockOracle.address)

        expect(await dca.oracle()).equal(newMockOracle.address)
      })

      it('2.11 Should allow governor to set oracle slippage', async () => {
        expect(await dca.slippage()).equal(ORACLE_SLIPPAGE)

        const newSlippage = 2 * BPS_MULTIPLIER

        await expect(dca.connect(governor).setSlippage(newSlippage))
          .emit(dca, EVENTS.SlippageUpdated)
          .withArgs(newSlippage)

        expect(await dca.slippage()).equal(newSlippage)
      })
    })

    describe('Transaction Reverted', () => {
      it('2.12 Should revert if caller is not governor', async () => {
        await expect(dca.connect(signers[0]).pause()).revertedWith('UnauthorizedCaller')

        await expect(dca.connect(signers[1]).unpause()).revertedWith('UnauthorizedCaller')

        await expect(dca.connect(signers[2]).addAllowedTokens([tokenA.address, tokenB.address])).revertedWith(
          'UnauthorizedCaller'
        )

        await expect(dca.connect(signers[2]).removeAllowedTokens([tokenA.address, tokenB.address])).revertedWith(
          'UnauthorizedCaller'
        )

        await expect(dca.connect(signers[2]).addSwapIntervalsToAllowedList([SwapIntervals.FourHour])).revertedWith(
          'UnauthorizedCaller'
        )

        await expect(dca.connect(signers[2]).removeSwapIntervalsFromAllowedList([SwapIntervals.FourHour])).revertedWith(
          'UnauthorizedCaller'
        )

        await expect(dca.connect(signers[2]).setSwapFee(5 * BPS_MULTIPLIER)).revertedWith('UnauthorizedCaller')

        await expect(dca.connect(signers[2]).setPlatformFeeRatio(50 * BPS_MULTIPLIER)).revertedWith(
          'UnauthorizedCaller'
        )

        await expect(dca.connect(signers[2]).setFeeVault(DUMMY_ADDRESS)).revertedWith('UnauthorizedCaller')

        await expect(dca.connect(signers[2]).setOracle(DUMMY_ADDRESS)).revertedWith('UnauthorizedCaller')

        await expect(dca.connect(signers[2]).setSlippage(2 * BPS_MULTIPLIER)).revertedWith('UnauthorizedCaller')
      })

      it('2.13 Should revert if contract is already paused (unPause)', async () => {
        await expect(dca.connect(governor).unpause()).revertedWith('Pausable: not pause')
      })

      it('2.14 Should revert if fee is more than max fee (setSwapFee)', async () => {
        await expect(dca.connect(governor).setSwapFee(11 * BPS_MULTIPLIER)).revertedWith('HighFee')
      })

      it('2.15 Should revert if fee is more than max fee (setPlatformFeeRatio)', async () => {
        await expect(dca.connect(governor).setPlatformFeeRatio(101 * BPS_MULTIPLIER)).revertedWith(
          'HighPlatformFeeRatio'
        )
      })

      it('2.16 Should revert if fee is more than max fee (setPlatformFeeRatio)', async () => {
        await expect(dca.connect(governor).setPlatformFeeRatio(101 * BPS_MULTIPLIER)).revertedWith(
          'HighPlatformFeeRatio'
        )
      })

      it('2.17 Should revert if interval is invalid', async () => {
        await expect(dca.connect(governor).addSwapIntervalsToAllowedList([duration.minutes(30)])).revertedWith(
          'InvalidInterval'
        )
      })

      it('2.18 Should revert if vault address is zero', async () => {
        await expect(dca.connect(governor).setFeeVault(ADDRESS_ZERO)).revertedWith('ZeroAddress')
      })

      it('2.19 Should revert if oracle address is zero', async () => {
        await expect(dca.connect(governor).setOracle(ADDRESS_ZERO)).revertedWith('ZeroAddress')
      })

      it('2.20 Should revert if slippage is more than max', async () => {
        await expect(dca.connect(governor).setSlippage(501)).revertedWith('InvalidSlippage')
      })
    })
  })

  describe('(3) DCA Position Handler', () => {
    const swapFee = 5 * BPS_MULTIPLIER
    const platformFee = 20 * BPS_MULTIPLIER

    beforeEach(async () => {
      await dca.connect(governor).addAllowedTokens([tokenA.address, tokenB.address, wNative.address])
      await mockOracle
        .connect(governor)
        .addFeedMapping(
          [tokenA.address, tokenB.address, wNative.address],
          [DUMMY_ADDRESS, DUMMY_ADDRESS, DUMMY_ADDRESS]
        )

      await dca
        .connect(governor)
        .addSwapIntervalsToAllowedList([SwapIntervals.FourHour, SwapIntervals.OneDay, SwapIntervals.OneWeek])

      await dca.connect(governor).setSwapFee(swapFee)
      await dca.connect(governor).setPlatformFeeRatio(platformFee)
      await dca.connect(governor).setFeeVault(feeVault.address)
    })

    describe('3.1 Create Position', () => {
      describe('Transaction Successful', () => {
        it('3.1.1 Should allow users to create position', async () => {
          const amount = parseTokenA(100)
          const noOfSwaps = 10

          await tokenA.connect(signers[1]).approve(dca.address, amount)

          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const swapAmountDelta = await dca.swapAmountDelta(
            tokenA.address,
            tokenB.address,
            SwapIntervalsBytes.OneDay,
            swapData.performedSwaps.add(noOfSwaps).add(1)
          )

          expect(swapData.performedSwaps).equal(ZERO)
          expect(swapData.nextAmountToSwap).equal(ZERO)
          expect(swapData.lastSwappedAt).equal(ZERO)
          expect(await dca.totalCreatedPositions()).equal(ZERO)

          const positionId = (await dca.totalCreatedPositions()).add(1)
          const rate = amount.div(noOfSwaps)
          const startingSwap = swapData.performedSwaps.add(1)
          const finalSwap = swapData.performedSwaps.add(noOfSwaps)

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', amount, noOfSwaps, SwapIntervals.OneDay)
          )
            .emit(dca, EVENTS.Created)
            .withArgs(
              signers[1].address,
              positionId,
              tokenA.address,
              tokenB.address,
              SwapIntervals.OneDay,
              rate,
              startingSwap,
              finalSwap,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(amount)

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(await dca.totalCreatedPositions()).equal(1)

          expect(hexToBinary(await dca.activeSwapIntervals(tokenA.address, tokenB.address))).equal('00001000')

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(rate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, finalSwap.add(1))
          ).equal(swapAmountDelta.add(rate))

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            finalSwap,
            SwapIntervalsBytes.OneDay,
            rate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.1.2 Should allow users to create position using native tokens', async () => {
          const amount = ethers.utils.parseEther('100')
          const noOfSwaps = 10

          const swapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const swapAmountDelta = await dca.swapAmountDelta(
            wNative.address,
            tokenB.address,
            SwapIntervalsBytes.OneDay,
            swapData.performedSwaps.add(noOfSwaps).add(1)
          )

          expect(swapData.performedSwaps).equal(ZERO)
          expect(swapData.nextAmountToSwap).equal(ZERO)
          expect(swapData.lastSwappedAt).equal(ZERO)
          expect(await dca.totalCreatedPositions()).equal(ZERO)

          const positionId = (await dca.totalCreatedPositions()).add(1)
          const rate = amount.div(noOfSwaps)
          const startingSwap = swapData.performedSwaps.add(1)
          const finalSwap = swapData.performedSwaps.add(noOfSwaps)

          expect(await wNative.balanceOf(dca.address)).equal(ZERO)
          const userBalance = await ethers.provider.getBalance(signers[1].address)

          await expect(
            dca
              .connect(signers[1])
              .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', amount, noOfSwaps, SwapIntervals.OneDay, {
                value: amount,
              })
          )
            .emit(dca, EVENTS.Created)
            .withArgs(
              signers[1].address,
              positionId,
              wNative.address,
              tokenB.address,
              SwapIntervals.OneDay,
              rate,
              startingSwap,
              finalSwap,
              true
            )

          expect(await wNative.balanceOf(dca.address)).equal(amount)

          const newSwapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(await wNative.balanceOf(dca.address)).equal(amount)
          expect(await ethers.provider.getBalance(signers[1].address)).closeTo(
            userBalance.sub(amount),
            ethers.utils.parseEther('0.02')
          )
          expect(await ethers.provider.getBalance(dca.address)).equal(ZERO)

          expect(await dca.totalCreatedPositions()).equal(1)

          expect(hexToBinary(await dca.activeSwapIntervals(wNative.address, tokenB.address))).equal('00001000')

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(rate))

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, finalSwap.add(1))
          ).equal(swapAmountDelta.add(rate))

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            finalSwap,
            SwapIntervalsBytes.OneDay,
            rate,
            wNative.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.1.3 Should allow users to create multiple position for different swapIntervals', async () => {
          const amount1 = parseTokenA(100)
          const amount2 = parseTokenA(200)
          const noOfSwaps1 = 10
          const noOfSwaps2 = 5

          await tokenA.connect(signers[1]).approve(dca.address, amount1.add(amount2))

          let swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          let swapAmountDelta = await dca.swapAmountDelta(
            tokenA.address,
            tokenB.address,
            SwapIntervalsBytes.OneDay,
            swapData.performedSwaps.add(noOfSwaps1).add(1)
          )

          expect(swapData.performedSwaps).equal(ZERO)
          expect(swapData.nextAmountToSwap).equal(ZERO)
          expect(swapData.lastSwappedAt).equal(ZERO)
          expect(await dca.totalCreatedPositions()).equal(ZERO)

          let rate = amount1.div(noOfSwaps1)
          let positionId = (await dca.totalCreatedPositions()).add(1)
          let startingSwap = swapData.performedSwaps.add(1)
          let finalSwap = swapData.performedSwaps.add(noOfSwaps1)

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', amount1, noOfSwaps1, SwapIntervals.OneDay)
          )
            .emit(dca, EVENTS.Created)
            .withArgs(
              signers[1].address,
              positionId,
              tokenA.address,
              tokenB.address,
              SwapIntervals.OneDay,
              rate,
              startingSwap,
              finalSwap,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(amount1)

          expect(await dca.totalCreatedPositions()).equal(1)

          expect(hexToBinary(await dca.activeSwapIntervals(tokenA.address, tokenB.address))).equal('00001000')

          expect(
            (await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)).nextAmountToSwap
          ).equal(swapData.nextAmountToSwap.add(rate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, finalSwap.add(1))
          ).equal(swapAmountDelta.add(rate))

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            finalSwap,
            SwapIntervalsBytes.OneDay,
            rate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // --------------------
          // create for 1Week

          swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneWeek)

          swapAmountDelta = await dca.swapAmountDelta(
            tokenA.address,
            tokenB.address,
            SwapIntervalsBytes.OneWeek,
            swapData.performedSwaps.add(noOfSwaps2).add(1)
          )

          rate = amount2.div(noOfSwaps2)
          positionId = (await dca.totalCreatedPositions()).add(1)
          startingSwap = swapData.performedSwaps.add(1)
          finalSwap = swapData.performedSwaps.add(noOfSwaps2)

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', amount2, noOfSwaps2, SwapIntervals.OneWeek)
          )
            .emit(dca, EVENTS.Created)
            .withArgs(
              signers[1].address,
              positionId,
              tokenA.address,
              tokenB.address,
              SwapIntervals.OneWeek,
              rate,
              startingSwap,
              finalSwap,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(amount1.add(amount2))

          expect(await dca.totalCreatedPositions()).equal(2)

          expect(hexToBinary(await dca.activeSwapIntervals(tokenA.address, tokenB.address))).equal('00101000')

          expect(
            (await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneWeek)).nextAmountToSwap
          ).equal(swapData.nextAmountToSwap.add(rate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneWeek, finalSwap.add(1))
          ).equal(swapAmountDelta.add(rate))

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            finalSwap,
            SwapIntervalsBytes.OneWeek,
            rate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.1.4 Should allow users to create position using permit', async () => {
          const signer = await impersonate(testAccount)
          const amount = parseTokenA(100)
          const noOfSwaps = 10
          const deadline = (await latest()).add(duration.minutes(10))

          // ------------------------------

          await updateBalance(signer.address)

          await tokenA.connect(deployer).mint(signer.address, parseTokenA(10000))

          const permitCallData = await generatePermitCalldata(
            signer.address,
            dca.address,
            amount.toString(),
            (await tokenA.nonces(signer.address)).toNumber(),
            deadline.toNumber(),
            await tokenA.DOMAIN_SEPARATOR(),
            process.env.TEST_ACCOUNT_KEY as string
          )

          // ------------------------------

          await expect(
            dca
              .connect(signer)
              .createPosition(tokenA.address, tokenB.address, permitCallData, amount, noOfSwaps, SwapIntervals.OneDay)
          ).emit(dca, EVENTS.Created)

          expect(await tokenA.balanceOf(dca.address)).equal(amount)
        })
      })

      describe('Transaction Reverted', () => {
        it('3.1.5 Should revert if contract is paused', async () => {
          await dca.connect(governor).pause()

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 10, SwapIntervals.OneDay)
          ).revertedWith('Pausable: paused')
        })

        it('3.1.6 Should revert if zero address token is used', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(ADDRESS_ZERO, tokenB.address, '0x', parseTokenA(100), 10, SwapIntervals.OneDay)
          ).revertedWith('ZeroAddress')

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, ADDRESS_ZERO, '0x', parseTokenA(100), 10, SwapIntervals.OneDay)
          ).revertedWith('ZeroAddress')
        })

        it('3.1.7 Should revert if both tokens are same', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenA.address, '0x', parseTokenA(100), 10, SwapIntervals.OneDay)
          ).revertedWith('InvalidToken')
        })

        it('3.1.8 Should revert if amount is zero', async () => {
          await expect(
            dca.connect(signers[1]).createPosition(tokenA.address, tokenB.address, '0x', 0, 10, SwapIntervals.OneDay)
          ).revertedWith('ZeroAmount')
        })

        it('3.1.9 Should revert if no of swaps is zero', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 0, SwapIntervals.OneDay)
          ).revertedWith('ZeroSwaps')
        })

        it('3.1.10 Should revert if tokens are not allowed for dca', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenC.address, '0x', parseTokenA(100), 10, SwapIntervals.OneDay)
          ).revertedWith('UnallowedToken')

          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenD.address, tokenB.address, '0x', parseTokenD(100), 10, SwapIntervals.OneDay)
          ).revertedWith('UnallowedToken')
        })

        it('3.1.11 Should revert if interval is not allowed', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 10, duration.minutes(30))
          ).revertedWith('InvalidInterval')

          // not allowed yet
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 10, SwapIntervals.OneMonth)
          ).revertedWith('IntervalNotAllowed')
        })

        it('3.1.12 Should revert if rate is invalid', async () => {
          await expect(
            dca.connect(signers[1]).createPosition(tokenA.address, tokenB.address, '0x', 9, 10, SwapIntervals.OneDay)
          ).revertedWith('InvalidRate')
        })

        it('3.1.13 Should revert if tokens are not approved', async () => {
          await expect(
            dca
              .connect(signers[1])
              .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 10, SwapIntervals.FourHour)
          ).revertedWith('ERC20: insufficient allowance')
        })

        it('3.1.14 Should revert if permit is invalid', async () => {
          const signer = await impersonate(testAccount)
          const amount = parseTokenA(100)

          await updateBalance(signer.address)

          await tokenA.connect(deployer).mint(signer.address, parseTokenA(10000))

          // -------------------------------

          let permitCallData = await generatePermitCalldata(
            signer.address,
            dca.address,
            amount.toString(),
            (await tokenA.nonces(signer.address)).toNumber(),
            (await latest()).toNumber(),
            await tokenA.DOMAIN_SEPARATOR(),
            process.env.TEST_ACCOUNT_KEY as string
          )

          // deadline expired
          await expect(
            dca
              .connect(signer)
              .createPosition(tokenA.address, tokenB.address, permitCallData, amount, 10, SwapIntervals.FourHour)
          ).revertedWith('InvalidPermit')

          // invalid nonce
          permitCallData = await generatePermitCalldata(
            signer.address,
            dca.address,
            amount.toString(),
            4,
            (await latest()).add(duration.minutes(10)).toNumber(),
            await tokenA.DOMAIN_SEPARATOR(),
            process.env.TEST_ACCOUNT_KEY as string
          )

          await expect(
            dca
              .connect(signer)
              .createPosition(tokenA.address, tokenB.address, permitCallData, amount, 10, SwapIntervals.FourHour)
          ).revertedWith('InvalidPermit')
        })

        it('3.1.15 Should revert if required native tokens havent been sent', async () => {
          const amount = ethers.utils.parseEther('100')
          const noOfSwaps = 10

          await expect(
            dca
              .connect(signers[1])
              .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', amount, noOfSwaps, SwapIntervals.OneDay, {
                value: amount.sub(1),
              })
          ).revertedWith('InvalidAmount')

          await expect(
            dca
              .connect(signers[1])
              .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', amount, noOfSwaps, SwapIntervals.OneDay, {
                value: amount.add(1),
              })
          ).revertedWith('InvalidAmount')
        })
      })
    })

    describe('3.2 Modify Position', () => {
      describe('Transaction Successful', () => {
        it('3.2.1 Should allow users to increase position', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // -------------------
          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const increaseAmount = parseTokenA(200)
          const newAmount = oldAmount.add(increaseAmount)
          const newNoOfSwap = 20
          const newRate = newAmount.div(newNoOfSwap)

          await tokenA.connect(signers[1]).approve(dca.address, increaseAmount)

          await expect(
            dca.connect(signers[1]).modifyPosition(positionId, increaseAmount, newNoOfSwap, '0x', true, false)
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, 1, newNoOfSwap, true, false)

          expect(await tokenA.balanceOf(dca.address)).equal(newAmount)

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps.add(newNoOfSwap)

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.2 Should allow users to increase position using Native Token', async () => {
          const oldAmount = parseEther('100')
          const oldNoOfSwap = 10

          await dca
            .connect(signers[1])
            .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay, {
              value: oldAmount,
            })

          const positionId = await dca.totalCreatedPositions()

          expect(await wNative.balanceOf(dca.address)).equal(oldAmount)

          // ------------------------------

          const swapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            wNative.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const increaseAmount = parseEther('200')
          const newAmount = oldAmount.add(increaseAmount)
          const newNoOfSwap = 20
          const newRate = newAmount.div(newNoOfSwap)

          await expect(
            dca
              .connect(signers[1])
              .modifyPosition(positionId, increaseAmount, newNoOfSwap, '0x', true, true, { value: increaseAmount })
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, 1, newNoOfSwap, true, true)

          expect(await wNative.balanceOf(dca.address)).equal(newAmount)

          const newSwapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps.add(newNoOfSwap)

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            wNative.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.3 Should allow users to increase position using permit', async () => {
          const signer = await impersonate(testAccount)

          await updateBalance(signer.address)

          await tokenA.connect(deployer).mint(signer.address, parseTokenA(10000))

          // --------------------------------------
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signer).approve(dca.address, oldAmount)

          await dca
            .connect(signer)
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          // --------------------------------------

          const increaseAmount = parseTokenA(200)
          const newAmount = oldAmount.add(increaseAmount)
          const newNoOfSwap = 20
          const newRate = newAmount.div(newNoOfSwap)
          const deadline = (await latest()).add(duration.minutes(10))

          const permitCallData = await generatePermitCalldata(
            signer.address,
            dca.address,
            increaseAmount.toString(),
            (await tokenA.nonces(signer.address)).toNumber(),
            deadline.toNumber(),
            await tokenA.DOMAIN_SEPARATOR(),
            process.env.TEST_ACCOUNT_KEY as string
          )

          await dca.connect(signer).modifyPosition(positionId, increaseAmount, newNoOfSwap, permitCallData, true, false)

          expect(await tokenA.balanceOf(dca.address)).equal(newAmount)

          // -----------------------------------

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps.add(newNoOfSwap)

          expect(newSwapData.nextAmountToSwap).equal(newRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            tokenA.address,
            tokenB.address,
            signer.address,
          ])
        })

        it('3.2.4 Should allow users to increase position (after swap)', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // ----------------------------------------

          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.lastSwappedAt).equal(0)
          expect(swapData.performedSwaps).equal(0)
          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // ----------------------------------------
          // swap 1 (1A = 1B)
          await tokenB.connect(deployer).transfer(mockExchange.address, parseTokenB('500'))

          let details = calculateAmountAndFee(oldRate, swapFee, platformFee)
          let returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await expect(dca.connect(governor).swap(swapDetails, governor.address)).emit(dca, EVENTS.Swapped)

          let swapData2 = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(swapData2.lastSwappedAt).equal(await latest())
          expect(swapData2.performedSwaps).equal(1)
          expect(swapData2.nextAmountToSwap).equal(oldRate)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, 1)).equal(
            calAmount(parseTokenB(1), swapFee)
          )

          // --------------------------------
          // swap 2 (1A = .5B)
          await tokenA.connect(signers[3]).approve(dca.address, parseTokenA(140))

          await dca
            .connect(signers[3])
            .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(140), 2, SwapIntervals.OneDay)
          const rate2 = parseTokenA(140).div(2)

          await advanceTimeAndBlock(duration.days(1))

          await mockExchange.changeRate(50)
          await mockOracle.connect(governor).changePrice(50, 100)

          details = calculateAmountAndFee(oldRate.add(rate2), swapFee, platformFee)

          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(500).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, 2)).equal(
            calAmount(parseTokenB(1 + 0.5), swapFee)
          )

          // --------------------------------
          // swap 3  (1A = 0.9B)

          await mockExchange.changeRate(90)
          await mockOracle.connect(governor).changePrice(90, 100)

          await advanceTimeAndBlock(duration.days(1))

          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(900).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, 3)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.9), swapFee)
          )

          swapData2 = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(swapData2.performedSwaps).equal(3)
          expect(swapData2.nextAmountToSwap).equal(oldRate)

          // --------------
          // 4th swap (1A = 0.75B)
          await mockExchange.changeRate(75)
          await mockOracle.connect(governor).changePrice(75, 100)

          await advanceTimeAndBlock(duration.days(1))

          details = calculateAmountAndFee(oldRate, swapFee, platformFee)

          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(750).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, 4)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.9 + 0.75), swapFee)
          )

          swapData2 = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(swapData2.performedSwaps).equal(4)
          expect(swapData2.nextAmountToSwap).equal(oldRate)

          // ---------------
          const performedSwaps = 4
          const increaseAmount = parseTokenA(200)
          const newAmount = oldAmount.sub(oldRate.mul(4)).add(increaseAmount)
          const newNoOfSwap = 20
          const newRate = newAmount.div(newNoOfSwap)

          await tokenA.connect(signers[1]).approve(dca.address, increaseAmount)

          const newStartingSwap = performedSwaps + 1
          const newFinalSwap = performedSwaps + newNoOfSwap

          const contractBalanceBefore = await await tokenA.balanceOf(dca.address)

          await expect(
            dca.connect(signers[1]).modifyPosition(positionId, increaseAmount, newNoOfSwap, '0x', true, false)
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, newStartingSwap, newFinalSwap, true, false)

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBefore.add(increaseAmount))

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(newSwapData.nextAmountToSwap).equal(swapData2.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap + 1)
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            BigNumber.from(performedSwaps),
            BigNumber.from(newFinalSwap),
            SwapIntervalsBytes.OneDay,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.5 Should allow users to reduce position', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // ------------------------------
          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const reduceAmount = parseTokenA(50)
          const newAmount = oldAmount.sub(reduceAmount)
          const newNoOfSwap = 5
          const newRate = newAmount.div(newNoOfSwap)

          const oldUserBalance = await tokenA.balanceOf(signers[1].address)
          const oldContractBalance = await tokenA.balanceOf(dca.address)

          await expect(
            dca.connect(signers[1]).modifyPosition(positionId, reduceAmount, newNoOfSwap, '0x', false, false)
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, 1, newNoOfSwap, false, false)

          expect(await tokenA.balanceOf(signers[1].address)).equal(oldUserBalance.add(reduceAmount))
          expect(await tokenA.balanceOf(dca.address)).equal(oldContractBalance.sub(reduceAmount))

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps.add(newNoOfSwap)

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.6 Should allow users to reduce position and get native tokens', async () => {
          const oldAmount = parseEther('100')
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay, {
              value: oldAmount,
            })

          const positionId = await dca.totalCreatedPositions()

          expect(await wNative.balanceOf(dca.address)).equal(oldAmount)

          const swapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            wNative.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const reduceAmount = parseEther('50')
          const newAmount = oldAmount.sub(reduceAmount)
          const newNoOfSwap = 5
          const newRate = newAmount.div(newNoOfSwap)

          const oldUserBalance = await ethers.provider.getBalance(signers[1].address)
          const oldContractBalance = await wNative.balanceOf(dca.address)

          await expect(dca.connect(signers[1]).modifyPosition(positionId, reduceAmount, newNoOfSwap, '0x', false, true))
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, 1, newNoOfSwap, false, true)

          expect(await ethers.provider.getBalance(signers[1].address)).closeTo(
            oldUserBalance.add(reduceAmount),
            parseEther('0.02')
          )
          expect(await wNative.balanceOf(dca.address)).equal(oldContractBalance.sub(reduceAmount))

          const newSwapData = await dca.swapData(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps.add(newNoOfSwap)

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            wNative.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.7 Should allow users to reduce position (to 0)', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // -------------------
          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const newNoOfSwap = 5 // which be changed to 0
          const unswapped = oldAmount

          const oldUserBalance = await tokenA.balanceOf(signers[1].address)
          const oldContractBalance = await tokenA.balanceOf(dca.address)

          await expect(dca.connect(signers[1]).modifyPosition(positionId, unswapped, newNoOfSwap, '0x', false, false))
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, 0, 1, 0, false, false)

          expect(await tokenA.balanceOf(signers[1].address)).equal(oldUserBalance.add(oldAmount))
          expect(await tokenA.balanceOf(dca.address)).equal(oldContractBalance.sub(oldAmount))

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)
          const newFinalSwap = newSwapData.performedSwaps

          expect(newSwapData.nextAmountToSwap).equal(ZERO)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(ZERO)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            ZERO,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.8 Should allow users to only change noOfSwaps (amount = 0)', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // -------------------
          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          const oldFinalSwap = swapData.performedSwaps.add(oldNoOfSwap)
          const oldRate = oldAmount.div(oldNoOfSwap)

          expect(swapData.nextAmountToSwap).equal(oldRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(oldRate)

          expect(await dca.userPositions(positionId)).eql([
            swapData.performedSwaps,
            oldFinalSwap,
            SwapIntervalsBytes.OneDay,
            oldRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])

          // ---------------
          const newNoOfSwap = 5 // which be changed to 0
          const newRate = oldAmount.div(newNoOfSwap)
          const newFinalSwap = swapData.performedSwaps.add(newNoOfSwap)

          const oldUserBalance = await tokenA.balanceOf(signers[1].address)
          const oldContractBalance = await tokenA.balanceOf(dca.address)

          await expect(dca.connect(signers[1]).modifyPosition(positionId, ZERO, newNoOfSwap, '0x', false, false))
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[1].address, positionId, newRate, 1, newFinalSwap, false, false)

          expect(await tokenA.balanceOf(signers[1].address)).equal(oldUserBalance)
          expect(await tokenA.balanceOf(dca.address)).equal(oldContractBalance)

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(newSwapData.nextAmountToSwap).equal(swapData.nextAmountToSwap.add(newRate).sub(oldRate))

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, newFinalSwap.add(1))
          ).equal(newRate)

          expect(
            await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, oldFinalSwap.add(1))
          ).equal(ZERO)

          expect(await dca.userPositions(positionId)).eql([
            newSwapData.performedSwaps,
            newFinalSwap,
            SwapIntervalsBytes.OneDay,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[1].address,
          ])
        })

        it('3.2.9 Should allow to reduce even id  token has been disallowed', async () => {
          const oldAmount = parseTokenA(100)
          const oldNoOfSwap = 10

          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          const positionId = await dca.totalCreatedPositions()

          expect(await tokenA.balanceOf(dca.address)).equal(oldAmount)

          // -------------------

          await dca.connect(governor).removeAllowedTokens([tokenA.address])

          await dca.connect(signers[1]).modifyPosition(positionId, parseTokenA(50), 5, signers[1].address, false, false)
        })
      })

      describe('Transaction Reverted', () => {
        const oldAmount = parseTokenA(100)
        const oldNoOfSwap = 10
        let positionId1: BigNumber
        let positionId2: BigNumber

        beforeEach(async () => {
          await tokenA.connect(signers[1]).approve(dca.address, oldAmount)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay)

          positionId1 = await dca.totalCreatedPositions()

          await dca
            .connect(signers[1])
            .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', oldAmount, oldNoOfSwap, SwapIntervals.OneDay, {
              value: oldAmount,
            })

          positionId2 = await dca.totalCreatedPositions()
        })

        it('3.2.10 Should revert if contract is paused', async () => {
          await dca.connect(governor).pause()

          await expect(
            dca.connect(signers[1]).modifyPosition(positionId1, parseTokenA(200), 20, '0x', true, false)
          ).revertedWith('Pausable: paused')
        })

        it('3.2.11 Should revert if token has been disallowed (increase)', async () => {
          await dca.connect(governor).removeAllowedTokens([tokenB.address])

          await expect(
            dca.connect(signers[1]).modifyPosition(positionId1, parseTokenA(200), 20, '0x', true, false)
          ).revertedWith('UnallowedToken')
        })

        it('3.2.12 Should revert if from token is not wNative', async () => {
          await expect(
            dca.connect(signers[1]).modifyPosition(positionId1, parseTokenA(200), 20, '0x', true, true)
          ).revertedWith('NotWNativeToken')
        })

        it('3.2.13 Should revert if required native tokens arent sent', async () => {
          const newAmount = parseTokenA(10)
          await expect(
            dca
              .connect(signers[1])
              .modifyPosition(positionId2, newAmount, 20, '0x', true, true, { value: newAmount.sub(1) })
          ).revertedWith('InvalidAmount')

          await expect(
            dca
              .connect(signers[1])
              .modifyPosition(positionId2, newAmount, 20, '0x', true, true, { value: newAmount.add(1) })
          ).revertedWith('InvalidAmount')
        })

        // it('3.2.14 Should revert if amount is zero', async () => {
        //   await expect(dca.connect(signers[1]).modifyPosition(positionId1, ZERO, 20, '0x', true, false)).revertedWith(
        //     'ZeroAmount'
        //   )
        // })

        it('3.2.14 Should revert if swap is zero (unSwapped > 0)', async () => {
          await expect(
            dca.connect(signers[1]).modifyPosition(positionId1, parseTokenA(200), 0, '0x', true, false)
          ).revertedWith('ZeroSwaps')

          // reduce amount to zero
          // await dca.connect(signers[1]).modifyPosition(positionId1, oldAmount, 0, '0x', false, false)
        })

        it('3.2.15 Should revert if caller is not position owner', async () => {
          await expect(dca.connect(signers[2]).modifyPosition(1, parseTokenA(200), 20, '0x', true, false)).revertedWith(
            'UnauthorizedCaller'
          )
        })

        it('3.2.16 Should revert if reduce amount is more than the unswapped tokens', async () => {
          await expect(dca.connect(signers[1]).modifyPosition(positionId1, parseTokenA(300), 5, '0x', true, false))
            .reverted
        })
      })
    })

    describe('3.3 Terminate Position', () => {
      let positionId1
      let positionId2
      let positionId3
      let user1ExpectedSwappedAmount: BigNumber
      let user1ExpectedUnSwappedAmount: BigNumber
      let user2ExpectedSwappedAmount: BigNumber
      let user2ExpectedUnSwappedAmount: BigNumber
      let user3ExpectedSwappedAmount: BigNumber
      let user3ExpectedUnSwappedAmount: BigNumber
      const amount1 = parseTokenA(100)
      const noOfSwap1 = 10
      const amount2 = parseTokenA(140)
      const noOfSwap2 = 2
      const amount3 = parseTokenA(150)
      const noOfSwap3 = 10
      const rate1 = amount1.div(noOfSwap1)
      const rate2 = amount2.div(noOfSwap2)
      const rate3 = amount3.div(noOfSwap3)

      beforeEach(async () => {
        await tokenB.connect(deployer).transfer(mockExchange.address, parseTokenB('1000'))

        await tokenA.connect(signers[1]).approve(dca.address, amount1)

        await dca
          .connect(signers[1])
          .createPosition(tokenA.address, tokenB.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour)

        positionId1 = await dca.totalCreatedPositions()

        let details = calculateAmountAndFee(rate1, swapFee, platformFee)
        let returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))

        const swapDetails = [
          {
            executor: ADDRESS_ZERO,
            desc: {
              srcToken: tokenA.address,
              dstToken: tokenB.address,
              srcReceiver: ADDRESS_ZERO,
              dstReceiver: ADDRESS_ZERO,
              amount: details.swapAmount,
              minReturnAmount: returnAmount,
              flags: 0,
              permit: '0x',
            },
            routeData: '0x',
          },
        ]

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 1000)
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(1))

        let accRatio = calAmount(parseTokenB(1), swapFee)

        expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 1)).equal(accRatio)

        // --------------------------------
        // swap 2
        await tokenA.connect(signers[2]).approve(dca.address, amount2)

        await dca
          .connect(signers[2])
          .createPosition(tokenA.address, tokenB.address, '0x', amount2, noOfSwap2, SwapIntervals.FourHour)

        positionId2 = await dca.totalCreatedPositions()

        await advanceTimeAndBlock(duration.hours(4))

        await mockExchange.changeRate(50)
        await mockOracle.connect(governor).changePrice(50, 100)

        details = calculateAmountAndFee(rate1.add(rate2), swapFee, platformFee)
        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(500).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 500)
        )
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(2))

        user2ExpectedSwappedAmount = calSwapped(rate2, swapFee, parseTokenA(1), parseTokenB(1), 500)

        user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(1))

        accRatio = accRatio.add(calAmount(parseTokenB(0.5), swapFee))

        expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 2)).equal(accRatio)

        // --------------------------------
        // swap 3

        await mockExchange.changeRate(90)
        await mockOracle.connect(governor).changePrice(90, 100)

        await advanceTimeAndBlock(duration.hours(4))

        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(900).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 900)
        )
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(3))

        user2ExpectedSwappedAmount = user2ExpectedSwappedAmount.add(
          calSwapped(rate2, swapFee, parseTokenA(1), parseTokenB(1), 900)
        )
        user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(2))

        accRatio = accRatio.add(calAmount(parseTokenB(0.9), swapFee))

        expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 3)).equal(accRatio)

        // --------------
        // 4th swap
        await mockExchange.changeRate(75)
        await mockOracle.connect(governor).changePrice(75, 100)
        await advanceTimeAndBlock(duration.days(1))

        details = calculateAmountAndFee(rate1, swapFee, platformFee)

        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(750).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 750)
        )
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(4))

        accRatio = accRatio.add(calAmount(parseTokenB(0.75), swapFee))

        expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 4)).equal(accRatio)

        let swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

        expect(swapData.performedSwaps).equal(4)
        expect(swapData.nextAmountToSwap).equal(rate1)

        // -------------------------------

        await tokenA.connect(signers[3]).approve(dca.address, amount3)

        await dca
          .connect(signers[3])
          .createPosition(tokenA.address, tokenB.address, '0x', amount3, noOfSwap3, SwapIntervals.FourHour)

        positionId3 = await dca.totalCreatedPositions()

        swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

        expect(swapData.performedSwaps).equal(4)
        expect(swapData.nextAmountToSwap).equal(rate1.add(rate3))

        // -------------------------------------
        // 5th swap
        await mockExchange.changeRate(80)
        await mockOracle.connect(governor).changePrice(80, 100)
        await advanceTimeAndBlock(duration.days(1))

        details = calculateAmountAndFee(rate1.add(rate3), swapFee, platformFee)

        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(800).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 800)
        )
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(5))

        user3ExpectedSwappedAmount = calSwapped(rate3, swapFee, parseTokenA(1), parseTokenB(1), 800)

        user3ExpectedUnSwappedAmount = amount3.sub(rate3.mul(1))

        accRatio = accRatio.add(calAmount(parseTokenB(0.8), swapFee))

        expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 5)).equal(accRatio)

        swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

        expect(swapData.performedSwaps).equal(5)
        expect(swapData.nextAmountToSwap).equal(rate1.add(rate3))
      })

      describe('Transaction Successful', () => {
        it('3.3.1 Should allow users to terminate position', async () => {
          const positionDetail1 = await dca.getPositionDetails(positionId1)
          const positionDetail2 = await dca.getPositionDetails(positionId2)
          const positionDetail3 = await dca.getPositionDetails(positionId3)

          // user 1
          expect(positionDetail1.owner).equal(signers[1].address)
          expect(positionDetail1.rate).equal(rate1)
          expect(positionDetail1.swapsExecuted).equal(5)
          expect(positionDetail1.swapsLeft).equal(noOfSwap1 - 5)
          expect(positionDetail1.swapped)
            .equal(user1ExpectedSwappedAmount)
            .equal(calAmount(parseTokenB(39.5), swapFee)) // rate : 10, price = 1, 0.5, 0.9, 0.75 0.8, 10 + 5 + 9 + 7.5 + 8
          expect(positionDetail1.unswapped)
            .equal(user1ExpectedUnSwappedAmount)
            .equal(amount1.sub(rate1.mul(5)))

          // user 2
          expect(positionDetail2.owner).equal(signers[2].address)
          expect(positionDetail2.rate).equal(rate2)
          expect(positionDetail2.swapsExecuted).equal(2)
          expect(positionDetail2.swapsLeft).equal(0)
          expect(positionDetail2.swapped)
            .equal(user2ExpectedSwappedAmount)
            .equal(calAmount(parseTokenB(98), swapFee)) // rate : 70, price = 1, 0.5, 0.9, 35 + 63
          expect(positionDetail2.unswapped).equal(user2ExpectedUnSwappedAmount).equal(ZERO)

          // user 3
          expect(positionDetail3.owner).equal(signers[3].address)
          expect(positionDetail3.rate).equal(rate3)
          expect(positionDetail3.swapsExecuted).equal(1)
          expect(positionDetail3.swapsLeft).equal(9)
          expect(positionDetail3.swapped)
            .equal(user3ExpectedSwappedAmount)
            .equal(calAmount(parseTokenB(12), swapFee)) // rate : 15, price = 0.8, 12
          expect(positionDetail3.unswapped)
            .equal(user3ExpectedUnSwappedAmount)
            .equal(amount3.sub(rate3.mul(1)))

          expect(await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(
            rate1
          )

          // ---------------------------------------------------

          const recipientSwapped = signers[1].address
          const recipientUnswapped = signers[5].address

          const contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          const contractBalanceBeforeB = await tokenB.balanceOf(dca.address)

          const receiverBalanceBeforeS = await tokenB.balanceOf(recipientSwapped)
          const receiverBalanceBeforeUS = await tokenA.balanceOf(recipientUnswapped)

          await expect(dca.connect(signers[1]).terminate(positionId1, recipientSwapped, recipientUnswapped, false))
            .emit(dca, EVENTS.Terminated)
            .withArgs(
              signers[1].address,
              recipientSwapped,
              recipientUnswapped,
              positionId1,
              user1ExpectedSwappedAmount,
              user1ExpectedUnSwappedAmount,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(user1ExpectedUnSwappedAmount))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user1ExpectedSwappedAmount))
          expect(await tokenB.balanceOf(recipientSwapped)).equal(receiverBalanceBeforeS.add(user1ExpectedSwappedAmount))
          expect(await tokenA.balanceOf(recipientUnswapped)).equal(
            receiverBalanceBeforeUS.add(user1ExpectedUnSwappedAmount)
          )

          expect((await dca.userPositions(positionId1)).swapIntervalMask).equal('0x00')
          expect((await dca.getPositionDetails(positionId1)).swapInterval).equal(0)

          const swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(swapData.performedSwaps).equal(5)
          expect(swapData.nextAmountToSwap).equal(rate3)

          expect(await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(ZERO)
        })

        it('3.3.2 Should allow users to terminate position (after modified : increase)', async () => {
          // create -> swap -> increase -> swap terminate
          expect(await dca.userPositions(positionId3)).eql([
            BigNumber.from(4), // lastUpdated
            BigNumber.from(14), // finalSwap (4 + 10)
            SwapIntervalsBytes.FourHour,
            rate3,
            tokenA.address,
            tokenB.address,
            signers[3].address,
          ])

          expect(
            await dca.swapAmountDelta(
              tokenA.address,
              tokenB.address,
              SwapIntervalsBytes.FourHour,
              15 // old final swap
            )
          ).equal(rate3)

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate3,
            BigNumber.from(1), // swap executed
            BigNumber.from(14 - 5), // swap left
            user3ExpectedSwappedAmount,
            user3ExpectedUnSwappedAmount,
          ])

          const increaseAmount = parseEther('165')
          const newAmount = user3ExpectedUnSwappedAmount.add(increaseAmount) // 135 + 165  = 300
          const newNoOfSwap = 5
          const newRate = newAmount.div(newNoOfSwap) // 60

          const startingSwap = 5 + 1
          const finalSwap = 5 + newNoOfSwap

          await tokenA.connect(signers[3]).approve(dca.address, increaseAmount)

          await expect(
            dca.connect(signers[3]).modifyPosition(positionId3, increaseAmount, newNoOfSwap, '0x', true, false)
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[3].address, positionId3, newRate, startingSwap, finalSwap, true, false)

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(newSwapData.performedSwaps).equal(5)
          expect(newSwapData.nextAmountToSwap).equal(rate1.add(newRate))

          expect((await dca.userPositions(positionId1)).finalSwap).equal(10)

          expect(await dca.userPositions(positionId3)).eql([
            BigNumber.from(5), // lastUpdated
            BigNumber.from(10), // finalSwap (5 + 5)
            SwapIntervalsBytes.FourHour,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[3].address,
          ])

          expect(
            await dca.swapAmountDelta(
              tokenA.address,
              tokenB.address,
              SwapIntervalsBytes.FourHour,
              14 // old final swap
            )
          ).equal(ZERO)

          expect(await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(
            rate1.add(newRate)
          ) // as final swap of 1 and 3 are same

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            ZERO, // swap executed
            BigNumber.from(10 - 5), // swap left
            user3ExpectedSwappedAmount,
            newAmount,
          ])

          // ------------------------------------------
          // swap 6

          await mockExchange.changeRate(60)
          await mockOracle.connect(governor).changePrice(60, 100)

          await advanceTimeAndBlock(duration.days(1))

          const details = calculateAmountAndFee(rate1.add(newRate), swapFee, platformFee)

          const returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(600).div(1000)

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
            calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 600)
          )
          user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(6))

          user3ExpectedSwappedAmount = user3ExpectedSwappedAmount.add(
            calSwapped(newRate, swapFee, parseTokenA(1), parseTokenB(1), 600)
          )

          user3ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(1))

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 6)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.9 + 0.75 + 0.8 + 0.6), swapFee)
          )

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate1,
            BigNumber.from(6), // swap executed
            BigNumber.from(10 - 6), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(1), // swap executed
            BigNumber.from(10 - 6), // swap left
            user3ExpectedSwappedAmount,
            user3ExpectedUnSwappedAmount,
          ])

          // -------------------------------------------------------------
          // terminate position 3

          const recipientSwapped = signers[5].address
          const recipientUnswapped = signers[3].address

          const contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          const contractBalanceBeforeB = await tokenB.balanceOf(dca.address)

          const receiverBalanceBeforeS = await tokenB.balanceOf(recipientSwapped)
          const receiverBalanceBeforeUS = await tokenA.balanceOf(recipientUnswapped)

          await expect(dca.connect(signers[3]).terminate(positionId3, recipientSwapped, recipientUnswapped, false))
            .emit(dca, EVENTS.Terminated)
            .withArgs(
              signers[3].address,
              recipientSwapped,
              recipientUnswapped,
              positionId3,
              user3ExpectedSwappedAmount,
              user3ExpectedUnSwappedAmount,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(user3ExpectedUnSwappedAmount))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user3ExpectedSwappedAmount))
          expect(await tokenB.balanceOf(recipientSwapped)).equal(receiverBalanceBeforeS.add(user3ExpectedSwappedAmount))
          expect(await tokenA.balanceOf(recipientUnswapped)).equal(
            receiverBalanceBeforeUS.add(user3ExpectedUnSwappedAmount)
          )

          expect((await dca.userPositions(positionId3)).swapIntervalMask).equal('0x00')

          const positionInfo = await dca.getPositionDetails(positionId3)
          expect(positionInfo.swapInterval).equal(0)
          expect(positionInfo.swapped).equal(0)
          expect(positionInfo.unswapped).equal(0)

          expect(
            (await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)).nextAmountToSwap
          ).equal(rate1)
        })

        it('3.3.3 Should allow users to terminate position (after modified : reduce)', async () => {
          // create -> swap -> reduce -> swap terminate
          expect(await dca.userPositions(positionId3)).eql([
            BigNumber.from(4), // lastUpdated
            BigNumber.from(14), // finalSwap (4 + 10)
            SwapIntervalsBytes.FourHour,
            rate3,
            tokenA.address,
            tokenB.address,
            signers[3].address,
          ])

          expect(
            await dca.swapAmountDelta(
              tokenA.address,
              tokenB.address,
              SwapIntervalsBytes.FourHour,
              15 // old final swap
            )
          ).equal(rate3)

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate3,
            BigNumber.from(1), // swap executed
            BigNumber.from(14 - 5), // swap left
            user3ExpectedSwappedAmount,
            user3ExpectedUnSwappedAmount,
          ])

          const reduceAmount = parseEther('35')
          const newAmount = user3ExpectedUnSwappedAmount.sub(reduceAmount) // 135 + 35  = 100
          const newNoOfSwap = 5
          const newRate = newAmount.div(newNoOfSwap) // 20

          const startingSwap = 5 + 1
          const finalSwap = 5 + newNoOfSwap

          await expect(
            dca.connect(signers[3]).modifyPosition(positionId3, reduceAmount, newNoOfSwap, '0x', false, false)
          )
            .emit(dca, EVENTS.Modified)
            .withArgs(signers[3].address, positionId3, newRate, startingSwap, finalSwap, false, false)

          const newSwapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(newSwapData.performedSwaps).equal(5)
          expect(newSwapData.nextAmountToSwap).equal(rate1.add(newRate))

          expect((await dca.userPositions(positionId1)).finalSwap).equal(10)

          expect(await dca.userPositions(positionId3)).eql([
            BigNumber.from(5), // lastUpdated
            BigNumber.from(10), // finalSwap (5 + 5)
            SwapIntervalsBytes.FourHour,
            newRate,
            tokenA.address,
            tokenB.address,
            signers[3].address,
          ])

          expect(
            await dca.swapAmountDelta(
              tokenA.address,
              tokenB.address,
              SwapIntervalsBytes.FourHour,
              14 // old final swap
            )
          ).equal(ZERO)

          expect(await dca.swapAmountDelta(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(
            rate1.add(newRate)
          ) // as final swap of 1 and 3 are same

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            ZERO, // swap executed
            BigNumber.from(10 - 5), // swap left
            user3ExpectedSwappedAmount,
            newAmount,
          ])

          // ------------------------------------------
          // swap 6

          await mockExchange.changeRate(60)
          await mockOracle.changePrice(60, 100)
          await advanceTimeAndBlock(duration.days(1))

          const details = calculateAmountAndFee(rate1.add(newRate), swapFee, platformFee)

          const returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(600).div(1000)

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
            calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 600)
          )
          user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(6))

          user3ExpectedSwappedAmount = user3ExpectedSwappedAmount.add(
            calSwapped(newRate, swapFee, parseTokenA(1), parseTokenB(1), 600)
          )

          user3ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(1))

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 6)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.9 + 0.75 + 0.8 + 0.6), swapFee)
          )

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate1,
            BigNumber.from(6), // swap executed
            BigNumber.from(10 - 6), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])

          expect(await dca.getPositionDetails(positionId3)).eql([
            signers[3].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(1), // swap executed
            BigNumber.from(10 - 6), // swap left
            user3ExpectedSwappedAmount,
            user3ExpectedUnSwappedAmount,
          ])

          // -------------------------------------------------------------
          // terminate position 3

          const recipientSwapped = signers[5].address
          const recipientUnswapped = signers[3].address

          const contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          const contractBalanceBeforeB = await tokenB.balanceOf(dca.address)

          const receiverBalanceBeforeS = await tokenB.balanceOf(recipientSwapped)
          const receiverBalanceBeforeUS = await tokenA.balanceOf(recipientUnswapped)

          await expect(dca.connect(signers[3]).terminate(positionId3, recipientSwapped, recipientUnswapped, false))
            .emit(dca, EVENTS.Terminated)
            .withArgs(
              signers[3].address,
              recipientSwapped,
              recipientUnswapped,
              positionId3,
              user3ExpectedSwappedAmount,
              user3ExpectedUnSwappedAmount,
              false
            )

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(user3ExpectedUnSwappedAmount))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user3ExpectedSwappedAmount))
          expect(await tokenB.balanceOf(recipientSwapped)).equal(receiverBalanceBeforeS.add(user3ExpectedSwappedAmount))
          expect(await tokenA.balanceOf(recipientUnswapped)).equal(
            receiverBalanceBeforeUS.add(user3ExpectedUnSwappedAmount)
          )

          expect((await dca.userPositions(positionId3)).swapIntervalMask).equal('0x00')

          const positionInfo = await dca.getPositionDetails(positionId3)
          expect(positionInfo.swapInterval).equal(0)
          expect(positionInfo.swapped).equal(0)
          expect(positionInfo.unswapped).equal(0)

          expect(
            (await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)).nextAmountToSwap
          ).equal(rate1)
        })

        it('3.3.4 Should allow users to terminate position (fromToken = Native)', async () => {
          const amount1 = parseEther('100')
          const noOfSwap1 = 10
          const rate1 = amount1.div(noOfSwap1)

          await mockExchange.changeRate(100)
          await mockOracle.connect(governor).changePrice(100, 100)

          await wNative.connect(deployer).deposit({ value: parseEther('200') })

          await wNative.connect(deployer).transfer(mockExchange.address, parseEther('200'))

          await dca
            .connect(signers[1])
            .createPosition(NATIVE_ADDRESS, tokenB.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour, {
              value: amount1,
            })
          const positionId1 = await dca.totalCreatedPositions()

          const details = calculateAmountAndFee(rate1, swapFee, platformFee)
          const returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))
          const user1ExpectedSwappedAmount = calSwapped(rate1, swapFee, parseEther('1'), parseTokenB(1), 1000)
          const user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(1))

          // --------------------------------

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: wNative.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          // ----------------------------
          expect(await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(
            rate1
          )

          const recipientSwapped = signers[1].address
          const recipientUnswapped = signers[5].address

          const contractBalanceBeforeA = await wNative.balanceOf(dca.address)
          const contractBalanceBeforeB = await tokenB.balanceOf(dca.address)

          const receiverBalanceBeforeS = await tokenB.balanceOf(recipientSwapped)
          const receiverBalanceBeforeUS = await ethers.provider.getBalance(recipientUnswapped)

          await expect(dca.connect(signers[1]).terminate(positionId1, recipientSwapped, recipientUnswapped, true))
            .emit(dca, EVENTS.Terminated)
            .withArgs(
              signers[1].address,
              recipientSwapped,
              recipientUnswapped,
              positionId1,
              user1ExpectedSwappedAmount,
              user1ExpectedUnSwappedAmount,
              true
            )

          expect(await wNative.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(user1ExpectedUnSwappedAmount))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user1ExpectedSwappedAmount))
          expect(await tokenB.balanceOf(recipientSwapped)).equal(receiverBalanceBeforeS.add(user1ExpectedSwappedAmount))
          expect(await ethers.provider.getBalance(recipientUnswapped)).equal(
            receiverBalanceBeforeUS.add(user1ExpectedUnSwappedAmount)
          )

          expect((await dca.userPositions(positionId1)).swapIntervalMask).equal('0x00')
          expect((await dca.getPositionDetails(positionId1)).swapInterval).equal(0)

          expect(await dca.swapAmountDelta(wNative.address, tokenB.address, SwapIntervalsBytes.FourHour, 11)).equal(
            ZERO
          )

          const positionInfo = await dca.getPositionDetails(positionId1)
          expect(positionInfo.swapInterval).equal(0)
          expect(positionInfo.swapped).equal(0)
          expect(positionInfo.unswapped).equal(0)
        })

        it('3.3.5 Should allow users to terminate position (toToken = Native)', async () => {
          const amount1 = parseTokenA('100')
          const noOfSwap1 = 10
          const rate1 = amount1.div(noOfSwap1)

          await mockExchange.changeRate(100)
          await mockOracle.connect(governor).changePrice(100, 100)

          await wNative.connect(deployer).deposit({ value: parseEther('200') })

          await wNative.connect(deployer).transfer(mockExchange.address, parseEther('200'))

          await tokenA.connect(signers[1]).approve(dca.address, amount1)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, wNative.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour)

          const positionId1 = await dca.totalCreatedPositions()

          // -------------------------------
          const details = calculateAmountAndFee(rate1, swapFee, platformFee)
          const returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: wNative.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          expect(await dca.swapAmountDelta(tokenA.address, wNative.address, SwapIntervalsBytes.FourHour, 11)).equal(
            rate1
          )

          user1ExpectedSwappedAmount = calSwapped(rate1, swapFee, parseTokenA(1), parseEther('1'), 1000)
          user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(1))

          // -------------------------------

          const recipientSwapped = signers[2].address
          const recipientUnswapped = signers[5].address

          const contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          const contractBalanceBeforeB = await wNative.balanceOf(dca.address)

          const receiverBalanceBeforeS = await ethers.provider.getBalance(recipientSwapped)
          const receiverBalanceBeforeUS = await tokenA.balanceOf(recipientUnswapped)

          await expect(dca.connect(signers[1]).terminate(positionId1, recipientSwapped, recipientUnswapped, true))
            .emit(dca, EVENTS.Terminated)
            .withArgs(
              signers[1].address,
              recipientSwapped,
              recipientUnswapped,
              positionId1,
              user1ExpectedSwappedAmount,
              user1ExpectedUnSwappedAmount,
              true
            )

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(user1ExpectedUnSwappedAmount))
          expect(await wNative.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user1ExpectedSwappedAmount))
          expect(await ethers.provider.getBalance(recipientSwapped)).equal(
            receiverBalanceBeforeS.add(user1ExpectedSwappedAmount)
          )
          expect(await tokenA.balanceOf(recipientUnswapped)).equal(
            receiverBalanceBeforeUS.add(user1ExpectedUnSwappedAmount)
          )

          expect((await dca.userPositions(positionId1)).swapIntervalMask).equal('0x00')
          expect((await dca.getPositionDetails(positionId1)).swapInterval).equal(0)

          expect(await dca.swapAmountDelta(tokenA.address, wNative.address, SwapIntervalsBytes.FourHour, 11)).equal(
            ZERO
          )

          const positionInfo = await dca.getPositionDetails(positionId1)
          expect(positionInfo.swapInterval).equal(0)
          expect(positionInfo.swapped).equal(0)
          expect(positionInfo.unswapped).equal(0)
        })
      })

      describe('Transaction Reverted', () => {
        it('3.3.6 Should revert if recipient is a zero address', async () => {
          await expect(
            dca.connect(signers[3]).terminate(positionId3, ADDRESS_ZERO, signers[3].address, false)
          ).revertedWith('ZeroAddress')

          await expect(
            dca.connect(signers[3]).terminate(positionId3, signers[3].address, ADDRESS_ZERO, false)
          ).revertedWith('ZeroAddress')
        })

        it('3.3.7 Should revert if position id is wrong', async () => {
          await expect(
            dca.connect(signers[3]).terminate(100, signers[3].address, signers[3].address, false)
          ).revertedWith('InvalidPosition')
        })

        it('3.3.8 Should revert if caller is not position owner', async () => {
          await expect(
            dca.connect(signers[2]).terminate(positionId3, signers[3].address, signers[3].address, false)
          ).revertedWith('UnauthorizedCaller')
        })

        it('3.3.9 Should revert if position is already terminated', async () => {
          await dca.connect(signers[3]).terminate(positionId3, signers[3].address, signers[3].address, false)

          await expect(
            dca.connect(signers[3]).terminate(positionId3, signers[3].address, signers[3].address, false)
          ).revertedWith('InvalidPosition')
        })

        it('3.3.4 hould revert if native flag is true and token used ared not wNative', async () => {
          await expect(
            dca.connect(signers[3]).terminate(positionId3, signers[3].address, signers[3].address, true)
          ).revertedWith('NotWNativeToken')
        })
      })
    })

    describe('3.4 Withdraw Swapped', () => {
      let positionId1
      let positionId2
      let user1ExpectedSwappedAmount: BigNumber
      let user1ExpectedUnSwappedAmount: BigNumber
      let user2ExpectedSwappedAmount: BigNumber
      let user2ExpectedUnSwappedAmount: BigNumber
      const amount1 = parseTokenA(100)
      const noOfSwap1 = 5
      const amount2 = parseTokenA(140)
      const noOfSwap2 = 2
      const rate1 = amount1.div(noOfSwap1)
      const rate2 = amount2.div(noOfSwap2)
      const newNoOfSwap = 10
      let newAmount: BigNumber
      let newRate

      // create 1 (5 swaps) -> swap 1 -> create 1 (2 swap) -> swap2 -> increase 1 (10 Swaps) -> swap 3 -> swap 5 -> withdrew 2 -> withdrew 2 -> swap5

      beforeEach(async () => {
        await tokenB.connect(deployer).transfer(mockExchange.address, parseTokenB('1000'))

        // --------------------------------------
        // create 1
        await tokenA.connect(signers[1]).approve(dca.address, amount1)

        await dca
          .connect(signers[1])
          .createPosition(tokenA.address, tokenB.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour)

        positionId1 = await dca.totalCreatedPositions()

        // --------------------------------------
        // swap 1

        let details = calculateAmountAndFee(rate1, swapFee, platformFee)
        let returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))

        const swapDetails = [
          {
            executor: ADDRESS_ZERO,
            desc: {
              srcToken: tokenA.address,
              dstToken: tokenB.address,
              srcReceiver: ADDRESS_ZERO,
              dstReceiver: ADDRESS_ZERO,
              amount: details.swapAmount,
              minReturnAmount: returnAmount,
              flags: 0,
              permit: '0x',
            },
            routeData: '0x',
          },
        ]

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 1000)
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(1))

        // --------------------------------------
        // create 2
        await tokenA.connect(signers[2]).approve(dca.address, amount2)

        await dca
          .connect(signers[2])
          .createPosition(tokenA.address, tokenB.address, '0x', amount2, noOfSwap2, SwapIntervals.FourHour)

        positionId2 = await dca.totalCreatedPositions()

        // --------------------------------------
        // swap 2
        await advanceTimeAndBlock(duration.hours(4))
        await mockExchange.changeRate(50)
        await mockOracle.connect(governor).changePrice(50, 100)

        details = calculateAmountAndFee(rate1.add(rate2), swapFee, platformFee)
        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(500).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(rate1, swapFee, parseTokenA(1), parseTokenB(1), 500)
        )
        user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(2))

        user2ExpectedSwappedAmount = calSwapped(rate2, swapFee, parseTokenA(1), parseTokenB(1), 500)

        user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(1))

        // --------------------------------------
        // increase 1
        const increaseAmount = parseEther('120')
        newAmount = user1ExpectedUnSwappedAmount.add(increaseAmount) // 80 + 120  = 200
        newRate = newAmount.div(newNoOfSwap)

        await tokenA.connect(signers[1]).approve(dca.address, increaseAmount)

        await dca.connect(signers[1]).modifyPosition(positionId1, increaseAmount, newNoOfSwap, '0x', true, false)

        // --------------------------------------
        // swap 3 (2 position gets finished)

        await advanceTimeAndBlock(duration.hours(4))
        await mockExchange.changeRate(75)
        await mockOracle.connect(governor).changePrice(75, 100)

        details = calculateAmountAndFee(newRate.add(rate2), swapFee, platformFee)

        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(750).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(newRate, swapFee, parseTokenA(1), parseTokenB(1), 750)
        )
        user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(1))

        user2ExpectedSwappedAmount = user2ExpectedSwappedAmount.add(
          calSwapped(rate2, swapFee, parseTokenA(1), parseTokenB(1), 750)
        )

        user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(2)) // ZERO

        // --------------------------------------
        // swap 4
        await advanceTimeAndBlock(duration.hours(4))
        await mockExchange.changeRate(80)
        await mockOracle.connect(governor).changePrice(80, 100)

        details = calculateAmountAndFee(newRate, swapFee, platformFee)

        returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(800).div(1000)

        swapDetails[0].desc.minReturnAmount = returnAmount
        swapDetails[0].desc.amount = details.swapAmount

        await dca.connect(governor).swap(swapDetails, governor.address)

        user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
          calSwapped(newRate, swapFee, parseTokenA(1), parseTokenB(1), 800)
        )
        user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(2))
      })

      describe('Transaction Successful', () => {
        it('3.4.1 Should allow users to withdraw tokens', async () => {
          expect(await dca.getPositionDetails(positionId2)).eql([
            signers[2].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate2,
            BigNumber.from(2), // swap executed
            ZERO, // swap left
            user2ExpectedSwappedAmount,
            user2ExpectedUnSwappedAmount,
          ])

          // all swaps are done
          let recipient = await signers[5].address

          let contractBalanceBeforeB = await tokenB.balanceOf(dca.address)
          let receiverBalanceBeforeS = await tokenB.balanceOf(recipient)

          await expect(dca.connect(signers[2]).withdrawSwapped(positionId2, recipient, false))
            .emit(dca, EVENTS.Withdrew)
            .withArgs(signers[2].address, recipient, positionId2, user2ExpectedSwappedAmount, false)

          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user2ExpectedSwappedAmount))

          expect(await tokenB.balanceOf(recipient)).equal(receiverBalanceBeforeS.add(user2ExpectedSwappedAmount))

          expect(await dca.getPositionDetails(positionId2)).eql([
            signers[2].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            rate2,
            ZERO, // swap executed
            ZERO, // swap left
            ZERO,
            ZERO,
          ])

          // ------------------------------
          // withdraw form 1st

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(4 - 2), // swap executed
            BigNumber.from(12 - 4), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])

          // all swaps are done
          recipient = await signers[6].address
          contractBalanceBeforeB = await tokenB.balanceOf(dca.address)
          receiverBalanceBeforeS = await tokenB.balanceOf(recipient)

          await expect(dca.connect(signers[1]).withdrawSwapped(positionId1, recipient, false))
            .emit(dca, EVENTS.Withdrew)
            .withArgs(signers[1].address, recipient, positionId1, user1ExpectedSwappedAmount, false)

          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user1ExpectedSwappedAmount))

          expect(await tokenB.balanceOf(recipient)).equal(receiverBalanceBeforeS.add(user1ExpectedSwappedAmount))

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(4 - 4), // swap executed
            BigNumber.from(12 - 4), // swap left
            ZERO,
            user1ExpectedUnSwappedAmount,
          ])

          // -----------------------------
          // swap 5
          await advanceTimeAndBlock(duration.hours(4))
          await mockExchange.changeRate(90)
          await mockOracle.connect(governor).changePrice(90, 100)

          const details = calculateAmountAndFee(newRate, swapFee, platformFee)

          const returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(900).div(1000)

          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = calSwapped(newRate, swapFee, parseTokenA(1), parseTokenB(1), 900)

          user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(3))

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            tokenB.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(5 - 4), // swap executed
            BigNumber.from(12 - 5), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])
        })

        it('3.4.2 Should allow users to withdraw tokens using native', async () => {
          const amount1 = parseTokenA(100)
          const noOfSwap1 = 5
          const amount2 = parseTokenA(140)
          const noOfSwap2 = 2
          const rate1 = amount1.div(noOfSwap1)
          const rate2 = amount2.div(noOfSwap2)
          const newNoOfSwap = 10

          await wNative.connect(deployer).deposit({ value: parseEther('300') })
          await wNative.connect(deployer).transfer(mockExchange.address, parseEther('300'))

          await mockExchange.changeRate(100)
          await mockOracle.connect(governor).changePrice(100, 100)

          // --------------------------------------
          // create 1
          await tokenA.connect(signers[1]).approve(dca.address, amount1)

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, wNative.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour)

          positionId1 = await dca.totalCreatedPositions()

          // --------------------------------------
          // swap 1

          let details = calculateAmountAndFee(rate1, swapFee, platformFee)
          let returnAmount = details.swapAmount.mul(parseEther('1')).div(parseTokenA(1))
          const swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: wNative.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, governor.address)

          let user1ExpectedSwappedAmount = calSwapped(rate1, swapFee, parseTokenA(1), parseEther('1'), 1000)
          let user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(1))

          // --------------------------------------
          // create 2

          await tokenA.connect(signers[2]).approve(dca.address, amount2)

          await dca
            .connect(signers[2])
            .createPosition(tokenA.address, wNative.address, '0x', amount2, noOfSwap2, SwapIntervals.FourHour)

          const positionId2 = await dca.totalCreatedPositions()

          // --------------------------------------
          // swap 2
          await advanceTimeAndBlock(duration.hours(4))
          await mockExchange.changeRate(50)
          await mockOracle.connect(governor).changePrice(50, 100)

          details = calculateAmountAndFee(rate1.add(rate2), swapFee, platformFee)
          returnAmount = details.swapAmount.mul(parseEther('1')).div(parseTokenA(1)).mul(500).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
            calSwapped(rate1, swapFee, parseTokenA(1), parseEther('1'), 500)
          )
          user1ExpectedUnSwappedAmount = amount1.sub(rate1.mul(2))

          user2ExpectedSwappedAmount = calSwapped(rate2, swapFee, parseTokenA(1), parseEther('1'), 500)

          user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(1))

          // --------------------------------------
          // increase 1
          const increaseAmount = parseEther('120')
          newAmount = user1ExpectedUnSwappedAmount.add(increaseAmount) // 80 + 120  = 200
          newRate = newAmount.div(newNoOfSwap)

          await tokenA.connect(signers[1]).approve(dca.address, increaseAmount)

          await dca.connect(signers[1]).modifyPosition(positionId1, increaseAmount, newNoOfSwap, '0x', true, false)

          // --------------------------------------
          // swap 3 (2 position gets finished)

          await advanceTimeAndBlock(duration.hours(4))
          await mockExchange.changeRate(75)
          await mockOracle.connect(governor).changePrice(75, 100)

          details = calculateAmountAndFee(newRate.add(rate2), swapFee, platformFee)

          returnAmount = details.swapAmount.mul(parseEther('1')).div(parseTokenA(1)).mul(750).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
            calSwapped(newRate, swapFee, parseTokenA(1), parseEther('1'), 750)
          )
          user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(1))

          user2ExpectedSwappedAmount = user2ExpectedSwappedAmount.add(
            calSwapped(rate2, swapFee, parseTokenA(1), parseEther('1'), 750)
          )

          user2ExpectedUnSwappedAmount = amount2.sub(rate2.mul(2)) // ZERO

          // --------------------------------------
          // swap 4
          await advanceTimeAndBlock(duration.hours(4))
          await mockExchange.changeRate(80)
          await mockOracle.connect(governor).changePrice(80, 100)

          details = calculateAmountAndFee(newRate, swapFee, platformFee)

          returnAmount = details.swapAmount.mul(parseEther('1')).div(parseTokenA(1)).mul(800).div(1000)

          swapDetails[0].desc.minReturnAmount = returnAmount
          swapDetails[0].desc.amount = details.swapAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = user1ExpectedSwappedAmount.add(
            calSwapped(newRate, swapFee, parseTokenA(1), parseEther('1'), 800)
          )
          user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(2))

          // -----------------
          expect(await dca.getPositionDetails(positionId2)).eql([
            signers[2].address,
            tokenA.address,
            wNative.address,
            SwapIntervals.FourHour,
            rate2,
            BigNumber.from(2), // swap executed
            ZERO, // swap left
            user2ExpectedSwappedAmount,
            user2ExpectedUnSwappedAmount,
          ])

          // all swaps are done
          let recipient = await signers[5].address
          let contractBalanceBeforeB = await wNative.balanceOf(dca.address)
          let receiverBalanceBeforeS = await ethers.provider.getBalance(recipient)

          await expect(dca.connect(signers[2]).withdrawSwapped(positionId2, recipient, true))
            .emit(dca, EVENTS.Withdrew)
            .withArgs(signers[2].address, recipient, positionId2, user2ExpectedSwappedAmount, true)

          expect(await wNative.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user2ExpectedSwappedAmount))

          expect(await ethers.provider.getBalance(recipient)).equal(
            receiverBalanceBeforeS.add(user2ExpectedSwappedAmount)
          )

          expect(await dca.getPositionDetails(positionId2)).eql([
            signers[2].address,
            tokenA.address,
            wNative.address,
            SwapIntervals.FourHour,
            rate2,
            ZERO, // swap executed
            ZERO, // swap left
            ZERO,
            ZERO,
          ])

          // ------------------------------
          // withdraw form 1st

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            wNative.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(4 - 2), // swap executed
            BigNumber.from(12 - 4), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])

          // all swaps are done
          recipient = await signers[6].address
          contractBalanceBeforeB = await wNative.balanceOf(dca.address)
          receiverBalanceBeforeS = await wNative.balanceOf(recipient)

          await expect(dca.connect(signers[1]).withdrawSwapped(positionId1, recipient, false))
            .emit(dca, EVENTS.Withdrew)
            .withArgs(signers[1].address, recipient, positionId1, user1ExpectedSwappedAmount, false)

          expect(await wNative.balanceOf(dca.address)).equal(contractBalanceBeforeB.sub(user1ExpectedSwappedAmount))

          expect(await wNative.balanceOf(recipient)).equal(receiverBalanceBeforeS.add(user1ExpectedSwappedAmount))

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            wNative.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(4 - 4), // swap executed
            BigNumber.from(12 - 4), // swap left
            ZERO,
            user1ExpectedUnSwappedAmount,
          ])

          // -----------------------------
          // swap 5
          await advanceTimeAndBlock(duration.hours(4))
          await mockExchange.changeRate(90)
          await mockOracle.connect(governor).changePrice(90, 100)

          details = calculateAmountAndFee(newRate, swapFee, platformFee)
          returnAmount = details.swapAmount.mul(parseEther('1')).div(parseTokenA(1)).mul(900).div(1000)
          swapDetails[0].desc.amount = details.swapAmount
          swapDetails[0].desc.minReturnAmount = returnAmount

          await dca.connect(governor).swap(swapDetails, governor.address)

          user1ExpectedSwappedAmount = calSwapped(newRate, swapFee, parseTokenA(1), parseEther('1'), 900)
          user1ExpectedUnSwappedAmount = newAmount.sub(newRate.mul(3))

          expect(await dca.getPositionDetails(positionId1)).eql([
            signers[1].address,
            tokenA.address,
            wNative.address,
            SwapIntervals.FourHour,
            newRate,
            BigNumber.from(5 - 4), // swap executed
            BigNumber.from(12 - 5), // swap left
            user1ExpectedSwappedAmount,
            user1ExpectedUnSwappedAmount,
          ])
        })

        it('3.4.3 Should allow users to withdraw tokens even if contract is paused', async () => {
          await dca.connect(governor).pause()

          await expect(dca.connect(signers[2]).withdrawSwapped(positionId2, signers[2].address, false))
            .emit(dca, EVENTS.Withdrew)
            .withArgs(signers[2].address, signers[2].address, positionId2, user2ExpectedSwappedAmount, false)
        })
      })

      describe('Transaction reverted', () => {
        it('3.4.4 Should revert if recipient is zero address', async () => {
          await expect(dca.connect(signers[2]).withdrawSwapped(positionId2, ZERO_ADDRESS, false)).revertedWith(
            'ZeroAddress'
          )
        })

        it('3.4.5 Should revert if token is not wNatice', async () => {
          await expect(dca.connect(signers[2]).withdrawSwapped(10, signers[2].address, true)).revertedWith(
            'NotWNativeToken'
          )
        })

        it('3.4.6 Should revert if position is invalid', async () => {
          await expect(dca.connect(signers[2]).withdrawSwapped(10, signers[2].address, false)).revertedWith(
            'InvalidPosition'
          )
        })

        it('3.4.7 Should revert if caller is not the position owner', async () => {
          await expect(dca.connect(signers[2]).withdrawSwapped(positionId1, signers[2].address, false)).revertedWith(
            'UnauthorizedCaller'
          )
        })

        it('3.4.8 Should revert if swapped amount is zero', async () => {
          await tokenA.connect(signers[3]).approve(dca.address, amount2)

          await dca
            .connect(signers[3])
            .createPosition(tokenA.address, wNative.address, '0x', amount2, noOfSwap2, SwapIntervals.FourHour)

          const positionId = await dca.totalCreatedPositions()

          await expect(dca.connect(signers[3]).withdrawSwapped(positionId, signers[3].address, false)).revertedWith(
            'ZeroSwappedAmount'
          )
        })
      })
    })
  })

  describe('(4) DCA Swap Handler', () => {
    const swapFee = 5 * BPS_MULTIPLIER
    const platformFee = 20 * BPS_MULTIPLIER

    beforeEach(async () => {
      await dca.connect(governor).addAllowedTokens([tokenA.address, tokenB.address, wNative.address])
      await mockOracle
        .connect(governor)
        .addFeedMapping(
          [tokenA.address, tokenB.address, wNative.address],
          [DUMMY_ADDRESS, DUMMY_ADDRESS, DUMMY_ADDRESS]
        )

      await dca
        .connect(governor)
        .addSwapIntervalsToAllowedList([SwapIntervals.FourHour, SwapIntervals.OneDay, SwapIntervals.OneWeek])

      await dca.connect(governor).setSwapFee(swapFee)
      await dca.connect(governor).setPlatformFeeRatio(platformFee)
      await dca.connect(governor).setFeeVault(feeVault.address)
    })

    describe('4.1 Swap', () => {
      describe('Transaction Successful', () => {
        it('4.1.1 Should swap the tokens (also combine intervals)', async () => {
          const amount1 = parseTokenA(100)
          const noOfSwap1 = 10

          const amount2 = parseTokenA(200)
          const noOfSwap2 = 40

          const amount3 = parseTokenA(140)
          const noOfSwap3 = 2

          const rate1 = amount1.div(noOfSwap1)
          const rate2 = amount2.div(noOfSwap2)
          const rate3 = amount3.div(noOfSwap3)

          // ------------------------------------

          await tokenA.connect(signers[1]).approve(dca.address, amount1)
          await tokenA.connect(signers[2]).approve(dca.address, amount2)
          await tokenA.connect(signers[3]).approve(dca.address, amount3)

          await tokenB.connect(deployer).transfer(mockExchange.address, parseTokenB('500'))

          // position 1
          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', amount1, noOfSwap1, SwapIntervals.FourHour)

          // ------------------------------------

          const secondsUntilNextSwap = await dca.secondsUntilNextSwap([
            {
              from: tokenA.address,
              to: tokenB.address,
            },
            {
              from: wNative.address,
              to: tokenB.address,
            },
          ])

          let swapInfo = await dca.getNextSwapInfo([
            {
              from: tokenA.address,
              to: tokenB.address,
            },
          ])

          let details = calculateAmountAndFee(rate1, swapFee, platformFee)

          expect(secondsUntilNextSwap[0]).equal(ZERO)
          expect(secondsUntilNextSwap[1]).equal(ethers.constants.MaxUint256) // not exist
          expect(swapInfo[0].fromToken).equal(tokenA.address)
          expect(swapInfo[0].toToken).equal(tokenB.address)
          expect(swapInfo[0].swappedAmount).equal(details.swapAmount)
          expect(swapInfo[0].reward).equal(details.swapReward)
          expect(swapInfo[0].platformFee).equal(details.platformFeeAmount)
          expect(hexToBinary(swapInfo[0].intervalsInSwap)).equal('00000010')

          // ------------------------------------
          // 1 swap (4 hour, rate1)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 1)).equal(0)

          let rewardRecipient = signers[5].address
          let returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))
          let swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          let contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          let contractBalanceBeforeB = await tokenB.balanceOf(dca.address)
          let swapperBalanceBeforeA = await tokenA.balanceOf(rewardRecipient)
          let feeVaultBalanceBeforeA = await tokenA.balanceOf(feeVault.address)

          await expect(dca.connect(governor).swap(swapDetails, rewardRecipient)).emit(dca, EVENTS.Swapped)

          const eventFilter = dca.filters.Swapped()
          const eventArgs = (await dca.queryFilter(eventFilter, 'latest'))[0].args

          expect(eventArgs.sender).equal(governor.address)
          expect(eventArgs.rewardRecipient).equal(rewardRecipient)
          expect(eventArgs.swapFee).equal(swapFee)
          expect(eventArgs.swapInformation[0]).eql([
            tokenA.address,
            tokenB.address,
            details.swapAmount,
            returnAmount,
            details.swapReward,
            details.platformFeeAmount,
            SwapIntervalsBytes.FourHour,
          ])

          let lastSwapTime = await latest()

          let swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(swapData.lastSwappedAt).equal(lastSwapTime)
          expect(swapData.performedSwaps).equal(1)
          expect(swapData.nextAmountToSwap).equal(rate1)

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(rate1))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.add(returnAmount))
          expect(await tokenA.balanceOf(rewardRecipient)).equal(swapperBalanceBeforeA.add(details.swapReward))
          expect(await tokenA.balanceOf(feeVault.address)).equal(feeVaultBalanceBeforeA.add(details.platformFeeAmount))

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 1)).equal(
            calAmount(parseTokenB(1), swapFee)
          )

          // ------------------------------------------
          // position 2
          await dca
            .connect(signers[3])
            .createPosition(tokenA.address, tokenB.address, '0x', amount3, noOfSwap3, SwapIntervals.FourHour)

          const nextSwapAfter = swapData.lastSwappedAt
            .div(SwapIntervals.FourHour)
            .add(1)
            .mul(SwapIntervals.FourHour)
            .sub(await latest())

          swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          swapInfo = await dca.getNextSwapInfo([
            {
              from: tokenA.address,
              to: tokenB.address,
            },
          ])

          expect(swapData.lastSwappedAt).equal(lastSwapTime)
          expect(swapData.performedSwaps).equal(1)
          expect(swapData.nextAmountToSwap).equal(rate1.add(rate3))

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).equal(nextSwapAfter)

          expect(swapInfo[0].fromToken).equal(tokenA.address)
          expect(swapInfo[0].toToken).equal(tokenB.address)
          expect(swapInfo[0].swappedAmount).equal(ADDRESS_ZERO)
          expect(swapInfo[0].reward).equal(ADDRESS_ZERO)
          expect(swapInfo[0].platformFee).equal(ADDRESS_ZERO)
          expect(hexToBinary(swapInfo[0].intervalsInSwap)).equal('00000000')

          // ------------------------------------------
          // advance
          await advanceTimeAndBlock(nextSwapAfter)

          swapInfo = await dca.getNextSwapInfo([
            {
              from: tokenA.address,
              to: tokenB.address,
            },
          ])

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).equal(ZERO)

          details = calculateAmountAndFee(rate1.add(rate3), swapFee, platformFee)

          expect(secondsUntilNextSwap[0]).equal(ZERO)
          expect(swapInfo[0].fromToken).equal(tokenA.address)
          expect(swapInfo[0].toToken).equal(tokenB.address)
          expect(swapInfo[0].swappedAmount).equal(details.swapAmount)
          expect(swapInfo[0].reward).equal(details.swapReward)
          expect(swapInfo[0].platformFee).equal(details.platformFeeAmount)
          expect(hexToBinary(swapInfo[0].intervalsInSwap)).equal('00000010')

          // ------------------------------------------
          // 2 swap (4 hour)

          await mockExchange.changeRate(50)
          await mockOracle.connect(governor).changePrice(50, 100)

          rewardRecipient = signers[6].address
          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(500).div(1000)

          swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          contractBalanceBeforeB = await tokenB.balanceOf(dca.address)
          swapperBalanceBeforeA = await tokenA.balanceOf(rewardRecipient)
          feeVaultBalanceBeforeA = await tokenA.balanceOf(feeVault.address)

          await dca.connect(governor).swap(swapDetails, rewardRecipient)
          lastSwapTime = await latest()

          swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(swapData.lastSwappedAt).equal(lastSwapTime)
          expect(swapData.performedSwaps).equal(2)
          expect(swapData.nextAmountToSwap).equal(rate1.add(rate3))

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(swapData.nextAmountToSwap))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.add(returnAmount))
          expect(await tokenA.balanceOf(rewardRecipient)).equal(swapperBalanceBeforeA.add(details.swapReward))
          expect(await tokenA.balanceOf(feeVault.address)).equal(feeVaultBalanceBeforeA.add(details.platformFeeAmount))

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).closeTo(duration.hours(4), 10)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 2)).equal(
            calAmount(parseTokenB(1 + 0.5), swapFee)
          )

          // ------------------------------------------
          // swap 3 (4 hour) (rate 3 is over)

          await mockExchange.changeRate(75)
          await mockOracle.connect(governor).changePrice(75, 100)

          // advance
          await advanceTimeAndBlock(duration.hours(4))

          rewardRecipient = signers[6].address
          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(750).div(1000)

          swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]

          await dca.connect(governor).swap(swapDetails, rewardRecipient)
          lastSwapTime = await latest()

          swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(swapData.lastSwappedAt).equal(lastSwapTime)
          expect(swapData.performedSwaps).equal(3)
          expect(swapData.nextAmountToSwap).equal(rate1)

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).closeTo(duration.hours(4), 10)

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 3)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.75), swapFee)
          )

          // ------------------------------------------
          // combine intervals

          await dca
            .connect(signers[2])
            .createPosition(tokenA.address, tokenB.address, '0x', amount2, noOfSwap2, SwapIntervals.OneDay)

          await advanceTimeAndBlock(duration.days(1))

          swapInfo = await dca.getNextSwapInfo([
            {
              from: tokenA.address,
              to: tokenB.address,
            },
          ])

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).equal(ZERO)

          details = calculateAmountAndFee(rate1.add(rate2), swapFee, platformFee)

          expect(secondsUntilNextSwap[0]).equal(ZERO)
          expect(swapInfo[0].fromToken).equal(tokenA.address)
          expect(swapInfo[0].toToken).equal(tokenB.address)
          expect(swapInfo[0].swappedAmount).equal(details.swapAmount)
          expect(swapInfo[0].reward).equal(details.swapReward)
          expect(swapInfo[0].platformFee).equal(details.platformFeeAmount)
          expect(hexToBinary(swapInfo[0].intervalsInSwap)).equal('00001010')

          let swapData2 = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(swapData2.lastSwappedAt).equal(0)
          expect(swapData2.performedSwaps).equal(0)
          expect(swapData2.nextAmountToSwap).equal(rate2)

          // ----------------------------------------

          await mockExchange.changeRate(90)
          await mockOracle.connect(governor).changePrice(90, 100)

          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1)).mul(900).div(1000)

          swapDetails[0].desc.amount = details.swapAmount
          swapDetails[0].desc.minReturnAmount = returnAmount

          contractBalanceBeforeA = await tokenA.balanceOf(dca.address)
          contractBalanceBeforeB = await tokenB.balanceOf(dca.address)
          swapperBalanceBeforeA = await tokenA.balanceOf(rewardRecipient)
          feeVaultBalanceBeforeA = await tokenA.balanceOf(feeVault.address)

          await dca.connect(governor).swap(swapDetails, rewardRecipient)
          lastSwapTime = await latest()

          swapData = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour)

          expect(swapData.lastSwappedAt).equal(lastSwapTime)
          expect(swapData.performedSwaps).equal(4)
          expect(swapData.nextAmountToSwap).equal(rate1)

          swapData2 = await dca.swapData(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay)

          expect(swapData2.lastSwappedAt).equal(lastSwapTime)
          expect(swapData2.performedSwaps).equal(1)
          expect(swapData2.nextAmountToSwap).equal(rate2)

          expect(await tokenA.balanceOf(dca.address)).equal(contractBalanceBeforeA.sub(rate1.add(rate2)))
          expect(await tokenB.balanceOf(dca.address)).equal(contractBalanceBeforeB.add(returnAmount))
          expect(await tokenA.balanceOf(rewardRecipient)).equal(swapperBalanceBeforeA.add(details.swapReward))
          expect(await tokenA.balanceOf(feeVault.address)).equal(feeVaultBalanceBeforeA.add(details.platformFeeAmount))

          expect(
            (
              await dca.secondsUntilNextSwap([
                {
                  from: tokenA.address,
                  to: tokenB.address,
                },
              ])
            )[0]
          ).lte(duration.hours(4))

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.FourHour, 4)).equal(
            calAmount(parseTokenB(1 + 0.5 + 0.75 + 0.9), swapFee)
          )

          expect(await dca.accumRatio(tokenA.address, tokenB.address, SwapIntervalsBytes.OneDay, 1)).equal(
            calAmount(parseTokenB(0.9), swapFee)
          )
        })
      })

      describe('Transaction Reverted', () => {
        let swapDetails
        let returnAmount

        beforeEach(async () => {
          await tokenB.connect(deployer).mint(mockExchange.address, parseTokenB('500'))

          await tokenA.connect(signers[1]).approve(dca.address, parseTokenA(100))

          await dca
            .connect(signers[1])
            .createPosition(tokenA.address, tokenB.address, '0x', parseTokenA(100), 10, SwapIntervals.FourHour)

          const rate = parseTokenA(100).div(10)
          const details = calculateAmountAndFee(rate, swapFee, platformFee)
          returnAmount = details.swapAmount.mul(parseTokenB(1)).div(parseTokenA(1))

          swapDetails = [
            {
              executor: ADDRESS_ZERO,
              desc: {
                srcToken: tokenA.address,
                dstToken: tokenB.address,
                srcReceiver: ADDRESS_ZERO,
                dstReceiver: ADDRESS_ZERO,
                amount: details.swapAmount,
                minReturnAmount: returnAmount,
                flags: 0,
                permit: '0x',
              },
              routeData: '0x',
            },
          ]
        })

        it('4.1.2 Should revert if contract is paused', async () => {
          await dca.connect(governor).pause()

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('Pausable: paused')
        })

        it('4.1.3 Should revert if dstReceiver is not zeroAddress', async () => {
          swapDetails[0].desc.dstReceiver = signers[0].address

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('InvalidDstReceiver')
        })

        it('4.1.4 Should revert partial fill is enabled', async () => {
          swapDetails[0].desc.flags = 5

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith(
            'PartialFillNotAllowed'
          )
        })

        it('4.1.5 Should revert no swaps are available', async () => {
          await dca.connect(governor).swap(swapDetails, signers[2].address)

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('NoAvailableSwap')
        })

        it('4.1.6 Should revert swap amount is wrong', async () => {
          swapDetails[0].desc.amount = returnAmount.sub(1)

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('InvalidSwapAmount')

          swapDetails[0].desc.amount = returnAmount.add(1)

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('InvalidSwapAmount')
        })

        it('4.1.7 Should revert return amount is less than minimum amount', async () => {
          swapDetails[0].desc.minReturnAmount = returnAmount.add(1)

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('InvalidReturnAmount')
        })

        it('4.1.8 Should revert return amount is less oracle amount', async () => {
          await mockExchange.connect(governor).changeRate(90)
          await mockOracle.connect(governor).changePrice(100, 100)

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('InvalidReturnAmount')
        })

        it('4.1.9 Should revert token details is wrong', async () => {
          swapDetails[0].desc.dstToken = tokenC.address

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('NoAvailableSwap')

          swapDetails[0].desc.dstToken = tokenA.address

          await expect(dca.connect(governor).swap(swapDetails, signers[2].address)).revertedWith('NoAvailableSwap')
        })
      })
    })
  })
})
