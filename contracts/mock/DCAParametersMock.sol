// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../libraries/SafeERC20.sol";

import { SwapData } from "./../common/Types.sol";

abstract contract DCAParametersMock {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => bytes1)) public activeSwapIntervals; // token A => token B => active swap intervals

    mapping(address => mapping(address => mapping(bytes1 => SwapData))) public swapData; // token A => token B => swap interval => swap data

    // The difference of tokens to swap between a swap, and the previous one
    mapping(address => mapping(address => mapping(bytes1 => mapping(uint256 => uint256)))) public swapAmountDelta; // token A => token B => swap interval => swap no => delta

    mapping(address => mapping(address => mapping(bytes1 => mapping(uint256 => uint256)))) public accumRatio; // token A => token B => swap interval => swap number => accum
}
