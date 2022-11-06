// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "../interfaces/IDaiLikePermit.sol";

import { InvalidPermitType, InvalidPermit } from "./../common/Error.sol";

abstract contract Permitable {
    function _permit(address token_, bytes memory permit_) internal {
        if (permit_.length > 0) {
            bool success;
            bytes memory result;
            if (permit_.length == 32 * 7) {
                // solhint-disable-next-line avoid-low-level-calls
                (success, result) = token_.call(abi.encodePacked(IERC20Permit.permit.selector, permit_));
            } else if (permit_.length == 32 * 8) {
                // solhint-disable-next-line avoid-low-level-calls
                (success, result) = token_.call(abi.encodePacked(IDaiLikePermit.permit.selector, permit_));
            } else {
                revert InvalidPermitType();
            }

            if (!success) revert InvalidPermit();
        }
    }
}
