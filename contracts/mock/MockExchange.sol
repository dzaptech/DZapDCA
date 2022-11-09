// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import "../libraries/SafeERC20.sol";

contract MockExchange {
    using SafeERC20 for IERC20;

    uint256 public rate = 100; // 100 = 1: 1, 50 = 1: .5

    function changeRate(uint256 rate_) external {
        require(rate_ > 0, "InvalidRate");
        rate = rate_;
    }

    function swap(
        IERC20 srcToken_,
        IERC20 dstToken_,
        uint256 amount_
    ) external returns (uint256 returnAmount, uint256 gasLeft) {
        returnAmount = (((amount_ * 10**dstToken_.decimals()) / 10**srcToken_.decimals()) * rate) / 100;

        srcToken_.safeTransferFrom(msg.sender, address(this), amount_);
        dstToken_.safeTransfer(msg.sender, returnAmount);

        gasLeft = gasleft();
    }
}
