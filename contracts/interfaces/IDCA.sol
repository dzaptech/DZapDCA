// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IDCAConfigHandler.sol";
import "./IDCAPositionHandler.sol";
import "./IDCASwapHandler.sol";
import "./IDCAParameters.sol";
import "./IDCAParameters.sol";

interface IDCA {
    event TokensRescued(address indexed to, address indexed token, uint256 amount);

    function rescueFunds(
        address token_,
        address to_,
        uint256 amount_
    ) external;
}
