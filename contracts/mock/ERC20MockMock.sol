/* SPDX-License-Identifier: MIT */
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract ERC20Mock is ERC20, Ownable, ERC20Permit {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal,
        uint256 supply
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimal;
        _mint(msg.sender, supply);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
