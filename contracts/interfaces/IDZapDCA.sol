// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IDCAConfigHandler.sol";
import "./IDCAPositionHandler.sol";
import "./IDCASwapHandler.sol";
import "./IDCAParameters.sol";
import "./IDCA.sol";

interface IDZapDCA is IDCA, IDCAParameters, IDCAConfigHandler, IDCAPositionHandler, IDCASwapHandler {}
