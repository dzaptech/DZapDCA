// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IWNative is IERC20 {
    function deposit() external payable;

    function withdraw(uint256) external;
}
