import { nodeUrls } from '../common'

export const getNodeUrl = (networkName: string, apiKey?: string) => {
  return apiKey ? `${nodeUrls[networkName]}/${apiKey}` : nodeUrls[networkName]
}
