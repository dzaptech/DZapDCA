// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./IAggregationExecutor.sol";

import { SwapDescription } from "./../common/Types.sol";

interface IAggregationRouterV4 {
    function swap(
        IAggregationExecutor caller,
        SwapDescription calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 gasLeft);
}
