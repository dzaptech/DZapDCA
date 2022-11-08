// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";

interface IChainlinkOracle {
    event MaxDelaySet(uint32 newMaxDelay);
    event FeedModified(address[] tokens, AggregatorV3Interface[] feeds);
    event MappingsAdded(address[] tokens, address[] underlying);

    function canSupportPair(address tokenA_, address tokenB_) external view returns (bool);

    function mappedToken(address token_) external view returns (address);

    function quote(
        address tokenIn_,
        uint256 amountIn_,
        address tokenOut_
    ) external view returns (uint256 amountOut_);

    function setMaxDelay(uint32 maxDelay_) external;

    function addFeedMapping(address[] calldata tokens_, AggregatorV3Interface[] calldata feeds_) external;

    function addMappings(address[] calldata addresses_, address[] calldata underlying_) external;
}
