export const getLatestEmittedEvent = async (contract: any, eventFilter: any) => {
  const data = await contract.queryFilter(eventFilter, 'latest')
  return data[data.length - 1].args
}

export function hexToBinary(hex) {
  return parseInt(hex, 16).toString(2).padStart(8, '0')
}

export function binaryToHex(binary) {
  return `0x${parseInt(binary, 2).toString(16)}`
}
