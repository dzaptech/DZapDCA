// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { SwapData } from "./../common/Types.sol";

interface IDCAParameters {
    function activeSwapIntervals(address from_, address to_) external view returns (bytes1);

    function swapData(
        address from_,
        address to_,
        bytes1 swapInterval_
    ) external view returns (SwapData memory);

    function swapAmountDelta(
        address from_,
        address to_,
        bytes1 swapInterval_,
        uint256 swapNo_
    ) external view returns (uint256);

    function accumRatio(
        address from_,
        address to_,
        bytes1 swapInterval_,
        uint256 swapNo_
    ) external view returns (uint256);
}
