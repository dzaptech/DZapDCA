/* eslint-disable camelcase */

import { ethers, network } from 'hardhat'

export const forkNetwork = async (jsonRpcUrl: string, blockNumber?: number) => {
  if (!blockNumber) {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl)
    blockNumber = (await provider.getBlockNumber()) - 30
    // blockNumber = await provider.getBlockNumber();
  }

  return network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl,
          blockNumber,
        },
      },
    ],
  })
}

export const resetNetwork = async (forking?: { [key: string]: any }) => {
  const params = forking ? [{ forking }] : []
  await network.provider.request({
    method: 'hardhat_reset',
    params,
  })
}

class SnapshotManager {
  snapshots: { [id: string]: string } = {}

  async take(): Promise<string> {
    const id = await this.takeSnapshot()
    this.snapshots[id] = id
    return id
  }

  async revert(id: string): Promise<void> {
    await this.revertSnapshot(this.snapshots[id])
    this.snapshots[id] = await this.takeSnapshot()
  }

  private async takeSnapshot(): Promise<string> {
    return (await network.provider.request({
      method: 'evm_snapshot',
      params: [],
    })) as string
  }

  private async revertSnapshot(id: string) {
    await network.provider.request({
      method: 'evm_revert',
      params: [id],
    })
  }
}

export const snapshot = new SnapshotManager()
