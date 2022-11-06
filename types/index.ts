import { BigNumber, BigNumberish, Signer } from "ethers";

/* -------------------- */
export interface CustomSigner extends Signer {
  address?: string;
}

export interface InputPositionDetails {
  from: string;
  to: string;
  permit: string;
  amount: BigNumber;
  noOfSwaps: number;
  swapInterval: BigNumberish;
}

export interface SwapParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: BigNumberish;
  fromAddress?: string;
  slippage: number;
  protocols?: string;
  destReceiver?: string;
  referrerAddress?: string;
  fee?: number;
  gasPrice?: number;
  permit?: string;
  burnChi?: boolean;
  complexityLevel?: string;
  connectorTokens?: string;
  allowPartialFill?: boolean;
  disableEstimate?: boolean;
  gasLimit?: number;
  mainRouteParts?: number;
  parts?: number;
}
/* -------------------- */

export interface ContractAddress {
  [key: string]: {
    otherContract?: string[];
    contract?: {
      [key: string]: {
        deployer: string;
      };
    };
  };
}
