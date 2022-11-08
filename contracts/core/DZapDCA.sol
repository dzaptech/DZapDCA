// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./DCAParameters.sol";
import "./DCAConfigHandler.sol";
import "./DCAPositionHandler.sol";
import "./DCASwapHandler.sol";
import "../interfaces/IDCA.sol";

contract DZapDCA is DCAParameters, DCAConfigHandler, DCASwapHandler, DCAPositionHandler, IDCA {
    using SafeERC20 for IERC20;

    constructor(
        address governor_,
        address wNative_,
        address oneInchRouter_,
        address oracle_
    ) DCAConfigHandler(governor_, wNative_, oracle_) DCASwapHandler(oneInchRouter_) {}

    /**
     * @dev Rescues tokens that are sent by mistake
     * @param token_ Address of token.
     * @param to_ Address of recipient.
     * @param amount_ Amount of tokens to be rescued.
     */
    function rescueFunds(
        address token_,
        address to_,
        uint256 amount_
    ) external onlyGovernance {
        require(to_ != address(0), "ZeroAddress");

        if (token_ == NATIVE_TOKEN) {
            _safeNativeTransfer(to_, amount_);
        } else {
            IERC20(token_).safeTransfer(to_, amount_);
        }

        emit TokensRescued(to_, token_, amount_);
    }

    // for unWrapping Native tokens
    receive() external payable {}
}
