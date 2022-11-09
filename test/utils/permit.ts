import { ethers } from 'hardhat'

const permitTypeHash = ethers.utils.keccak256(
  Buffer.from('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const permitTypeHashForDai = ethers.utils.keccak256(
  Buffer.from('Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)')
)

const strip0x = (v: string) => {
  return v.replace(/^0x/, '')
}

const bufferFromHexString = (hex: string) => {
  return Buffer.from(strip0x(hex), 'hex')
}

const ecSign = (digest: string, privateKey: string) => {
  const signingKey = new ethers.utils.SigningKey(bufferFromHexString(privateKey))
  return signingKey.signDigest(bufferFromHexString(digest))
}

export const generatePermitCalldata = (
  owner: string,
  spender: string,
  value: number | string,
  nonce: number,
  deadline: number | string,
  domainSeparator: string,
  privateKey: string
) => {
  const { v, r, s } = signPermit(owner, spender, value, nonce, deadline, domainSeparator, privateKey)

  return ethers.utils.defaultAbiCoder.encode(
    ['address owner', 'address spender', 'uint256 value', 'uint256 deadline', 'uint8 v', 'bytes32 r', 'bytes32 s'],
    [owner, spender, value, deadline, v, r, s]
  )
}

export const generateDaiPermitCalldata = (
  holder: string,
  spender: string,
  nonce: number,
  expiry: number | string,
  allowed: boolean,
  domainSeparator: string,
  privateKey: string
) => {
  const { v, r, s } = signDaiPermit(holder, spender, nonce, expiry, allowed, domainSeparator, privateKey)

  return ethers.utils.defaultAbiCoder.encode(
    [
      'address holder',
      'address spender',
      'uint256 nonce',
      'uint256 expiry',
      'bool allowed',
      'uint8 v',
      'bytes32 r',
      'bytes32 s',
    ],
    [holder, spender, nonce, expiry, allowed, v, r, s]
  )
}

export const signPermit = (
  owner: string,
  spender: string,
  value: number | string,
  nonce: number,
  deadline: number | string,
  domainSeparator: string,
  privateKey: string
) => {
  return signEIP712Eth(
    domainSeparator,
    permitTypeHash,
    ['address', 'address', 'uint256', 'uint256', 'uint256'],
    [owner, spender, value, nonce, deadline],
    privateKey
  )
}

export const signDaiPermit = (
  holder: string,
  spender: string,
  nonce: number,
  expiry: number | string,
  allowed: boolean,
  domainSeparator: string,
  privateKey: string
) => {
  return signEIP712Eth(
    domainSeparator,
    permitTypeHashForDai,
    ['address', 'address', 'uint256', 'uint256', 'bool'],
    [holder, spender, nonce, expiry, allowed],
    privateKey
  )
}

export const signEIP712Eth = (
  domainSeparator: string,
  typeHash: string,
  types: string[],
  parameters: (string | number | boolean)[],
  privateKey: string
) => {
  const digest = ethers.utils.keccak256(
    '0x1901' +
      strip0x(domainSeparator) +
      strip0x(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['bytes32', ...types], [typeHash, ...parameters]))
      )
  )

  return ecSign(digest, privateKey)
}
