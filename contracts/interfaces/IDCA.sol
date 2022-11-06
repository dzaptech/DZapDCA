// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IDCAConfigHandler.sol";
import "./IDCAPositionHandler.sol";
import "./IDCASwapHandler.sol";
import "./IDCAParameters.sol";

interface IDCA is IDCAParameters, IDCAConfigHandler, IDCAPositionHandler, IDCASwapHandler {}
