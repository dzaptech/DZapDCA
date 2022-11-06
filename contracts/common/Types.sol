// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../interfaces/IERC20.sol";
import "../interfaces/IAggregationExecutor.sol";

/// @notice Swap information about a specific pair
struct SwapData {
    uint256 performedSwaps;
    uint256 nextAmountToSwap;
    uint256 lastSwappedAt;
}

struct UserPosition {
    uint256 swapWhereLastUpdated; // Includes both modify and withdraw
    uint256 finalSwap;
    bytes1 swapIntervalMask;
    uint256 rate;
    address from;
    address to;
    address owner;
}

struct PositionInfo {
    address owner;
    address from;
    address to;
    uint32 swapInterval;
    uint256 rate;
    uint256 swapsExecuted;
    uint256 swapsLeft;
    uint256 swapped;
    uint256 unswapped;
}

/// @notice Information about a swap
// feeAmount = reward + platformFee
// swappedAmount = mount - feeAmount
struct SwapInfo {
    address fromToken;
    address toToken;
    uint256 swappedAmount;
    uint256 receivedAmount;
    uint256 reward;
    uint256 platformFee;
    bytes1 intervalsInSwap;
}

struct SwapDescription {
    IERC20 srcToken;
    IERC20 dstToken;
    address payable srcReceiver;
    address payable dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    uint256 flags;
    bytes permit;
}

struct SwapDetails {
    IAggregationExecutor executor;
    SwapDescription desc;
    bytes routeData;
}

struct PositionSet {
    address token; // The `to` token
    uint256[] positionIds; // The position ids
    bool isNative;
}

/// @notice A pair of tokens
struct Pair {
    address from;
    address to;
}

struct InputPositionDetails {
    address from;
    address to;
    bytes permit;
    uint256 amount;
    uint256 noOfSwaps;
    uint32 swapInterval;
}
