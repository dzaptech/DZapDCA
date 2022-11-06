import { Signer } from 'ethers'
import { ethers, upgrades } from 'hardhat'

export const deployContract = async (deployer: Signer, contractName: string, args: any[] = [], libraries = {}) => {
  const ContractFactory = await ethers.getContractFactory(contractName, { libraries })
  const contract = await ContractFactory.connect(deployer).deploy(...args)
  return await contract.deployed()
}

export const deployProxyContract = async (deployer: Signer, contractName: string, args: any[] = [], libraries = {}) => {
  const ContractFactory = await ethers.getContractFactory(contractName, { signer: deployer, libraries })

  const proxy = await upgrades.deployProxy(ContractFactory, args, {
    kind: 'uups',
    unsafeAllowLinkedLibraries: true,
  })
  await proxy.deployed()

  const implementation = await upgrades.erc1967.getImplementationAddress(proxy.address)

  return [proxy.address, implementation]
}
