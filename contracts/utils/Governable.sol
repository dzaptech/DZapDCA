// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Context.sol";

import { UnauthorizedCaller, ZeroAddress } from "../common/Error.sol";

abstract contract Governable is Context {
    address private _governance;

    event GovernanceChanged(address indexed formerGov, address indexed newGov);

    /**
     * @dev Throws if called by any account other than the governance.
     */
    modifier onlyGovernance() {
        if (governance() != _msgSender()) revert UnauthorizedCaller();
        _;
    }

    /**
     * @dev Initializes the contract setting the deployer as the initial governance.
     */
    constructor(address governance_) {
        if (governance_ == address(0)) revert ZeroAddress();
        _governance = governance_;
        emit GovernanceChanged(address(0), governance_);
    }

    /**
     * @dev Returns the address of the current governance.
     */
    function governance() public view virtual returns (address) {
        return _governance;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newGov`).
     * Can only be called by the current governance.
     */
    function changeGovernance(address newGov) public virtual onlyGovernance {
        if (newGov == address(0)) revert ZeroAddress();
        emit GovernanceChanged(_governance, newGov);
        _governance = newGov;
    }
}
