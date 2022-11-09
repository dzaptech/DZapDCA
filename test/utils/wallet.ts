import { Wallet } from 'ethers'
import { ethers, network } from 'hardhat'
import { parseUnits } from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export const impersonate = async (address: string) => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })

  const signer = (await ethers.provider.getSigner(address)) as any
  signer.address = address

  return signer as SignerWithAddress
}

export const updateBalance = async (address: string, newBalance = '10000') => {
  await ethers.provider.send('hardhat_setBalance', [address, parseUnits(newBalance).toHexString().replace('0x0', '0x')])
}

export const generateRandomWallet = async () => {
  const wallet = (await Wallet.createRandom()).connect(ethers.provider)
  await updateBalance(wallet.address)

  return wallet
}

export const createWalletUsingPrivateKey = (privateKey: string) => {
  let testingWallet: Wallet
  try {
    testingWallet = new Wallet(privateKey)
  } catch (error) {
    throw Error('Wallet cant be created, please verify private key')
  }

  return testingWallet
}
