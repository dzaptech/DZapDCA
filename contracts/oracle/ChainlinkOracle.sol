// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "./../utils/Governable.sol";
import "./../interfaces/IERC20.sol";
import "./../interfaces/IChainlinkOracle.sol";

import { ZeroMaxDelay, PairNotSupported, LastUpdateIsTooOld, InvalidPrice, InvalidMappingsInput } from "./../common/Error.sol";

/**
 * only token/USD
 * ETH/USD, token/ETH or token/USD
 * prices when both tokens share the same base : TOKEN_TO_USD_TO_TOKEN_PAIR, TOKEN_TO_ETH_TO_TOKEN_PAIR
 * prices when one of the tokens uses ETH as the base, and the other USD : TOKEN_A_TO_USD_TO_ETH_TO_TOKEN_B, TOKEN_A_TO_ETH_TO_USD_TO_TOKEN_B
 */
contract ChainlinkOracle is Governable, IChainlinkOracle {
    mapping(address => AggregatorV3Interface) public feedMapping; // tokens -> feedMapping
    mapping(address => address) internal _tokenMappings;

    uint256 public maxDelay;

    constructor(address governor_, uint32 maxDelay_) Governable(governor_) {
        if (maxDelay_ == 0) revert ZeroMaxDelay();
        maxDelay = maxDelay_;
    }

    function canSupportPair(address tokenA_, address tokenB_) public view returns (bool) {
        return (address(feedMapping[tokenA_]) != address(0) && address(feedMapping[tokenB_]) != address(0));
    }

    function mappedToken(address token_) public view returns (address) {
        address underlyingToken = _tokenMappings[token_];
        return underlyingToken != address(0) ? underlyingToken : token_;
    }

    function setMaxDelay(uint32 maxDelay_) external onlyGovernance {
        maxDelay = maxDelay_;
        emit MaxDelaySet(maxDelay_);
    }

    function addFeedMapping(address[] calldata tokens_, AggregatorV3Interface[] calldata feeds_)
        external
        onlyGovernance
    {
        if (tokens_.length != feeds_.length) revert InvalidMappingsInput();

        for (uint256 i; i < tokens_.length; i++) {
            feedMapping[tokens_[i]] = feeds_[i];
        }

        emit FeedModified(tokens_, feeds_);
    }

    function addMappings(address[] calldata addresses_, address[] calldata underlying_) external onlyGovernance {
        if (addresses_.length != underlying_.length) revert InvalidMappingsInput();
        for (uint256 i; i < addresses_.length; i++) {
            _tokenMappings[addresses_[i]] = underlying_[i];
        }
        emit MappingsAdded(addresses_, underlying_);
    }

    function quote(
        address tokenIn_,
        uint256 amountIn_,
        address tokenOut_
    ) external view returns (uint256 amountOut_) {
        AggregatorV3Interface feedA = feedMapping[mappedToken(tokenIn_)];
        AggregatorV3Interface feedB = feedMapping[mappedToken(tokenOut_)];

        if (address(feedA) == address(0) || address(feedB) == address(0)) revert PairNotSupported();

        int8 inDecimals = _getDecimals(tokenIn_);
        int8 outDecimals = _getDecimals(tokenOut_);

        uint256 tokenInToBase = _callRegistry(feedA);
        uint256 tokenOutToBase = _callRegistry(feedB);
        return _adjustDecimals((amountIn_ * tokenInToBase) / tokenOutToBase, outDecimals - inDecimals);
    }

    function _callRegistry(AggregatorV3Interface feed_) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = feed_.latestRoundData();
        if (price <= 0) revert InvalidPrice();
        if (maxDelay < block.timestamp && updatedAt < block.timestamp - maxDelay) revert LastUpdateIsTooOld();
        return uint256(price);
    }

    function _getDecimals(address _token) internal view returns (int8) {
        return int8(IERC20(_token).decimals());
    }

    function _adjustDecimals(uint256 amount_, int256 factor_) internal pure returns (uint256) {
        if (factor_ < 0) {
            return amount_ / (10**uint256(-factor_));
        } else {
            return amount_ * (10**uint256(factor_));
        }
    }
}
