import { run } from 'hardhat'

export async function verifyContract(contractAddress: string, args: any[], contract?: string) {
  if (contract) {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
      contract,
    })
  } else {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
    })
  }
}
