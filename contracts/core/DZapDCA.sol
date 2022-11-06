// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./DCAParameters.sol";
import "./DCAConfigHandler.sol";
import "./DCAPositionHandler.sol";
import "./DCASwapHandler.sol";

contract DZapDCA is DCAParameters, DCAConfigHandler, DCASwapHandler, DCAPositionHandler {
    constructor(
        address governor_,
        address wNative_,
        address oneInchRouter_
    ) DCAConfigHandler(governor_, wNative_) DCASwapHandler(oneInchRouter_) {}

    // for unWrapping Native tokens
    receive() external payable {}
}
