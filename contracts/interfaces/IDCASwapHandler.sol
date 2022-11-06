// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { SwapInfo, SwapDetails, Pair } from "./../common/Types.sol";

interface IDCASwapHandler {
    event Swapped(address indexed sender, address indexed rewardRecipient, SwapInfo[] swapInformation, uint256 swapFee);

    function secondsUntilNextSwap(Pair[] calldata pairs_) external view returns (uint256[] memory);

    function getNextSwapInfo(Pair[] calldata pairs_) external view returns (SwapInfo[] memory);

    function swap(SwapDetails[] calldata data_, address rewardRecipient_) external returns (SwapInfo[] memory);
}
