// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../utils/Governable.sol";
import "./../interfaces/IERC20.sol";
import "./../interfaces/IChainlinkOracle.sol";

contract MockOracle is Governable, IChainlinkOracle {
    mapping(address => AggregatorV3Interface) public feedMapping; // tokens -> feedMapping
    mapping(address => address) internal _tokenMappings;

    uint256 public maxDelay;

    // uint256 public price1 = 200; // 1 tokensA -> 2 tokenB, 200 / 100
    // uint256 public price2 = 50; // 1 tokensA -> .5 tokenB, 50 / 100

    uint256 public price1 = 100;
    uint256 public price2 = 100;

    constructor(address governor_, uint32 maxDelay_) Governable(governor_) {
        require(maxDelay_ > 0, "ZeroMaxDelay");
        require(maxDelay_ < block.timestamp, "InvalidDelay");
        maxDelay = maxDelay_;
    }

    function canSupportPair(address tokenA_, address tokenB_) public view returns (bool) {
        return (address(feedMapping[tokenA_]) != address(0) && address(feedMapping[tokenB_]) != address(0));
    }

    function mappedToken(address token_) public view returns (address) {
        address underlyingToken = _tokenMappings[token_];
        return underlyingToken != address(0) ? underlyingToken : token_;
    }

    function changePrice(uint256 price1_, uint256 price2_) external {
        require(price1_ > 0 && price2_ > 0, "InvalidPrice");
        price1 = price1_;
        price2 = price2_;
    }

    function setMaxDelay(uint32 maxDelay_) external onlyGovernance {
        maxDelay = maxDelay_;
        emit MaxDelaySet(maxDelay_);
    }

    function addFeedMapping(address[] calldata tokens_, AggregatorV3Interface[] calldata feeds_)
        external
        onlyGovernance
    {
        require(tokens_.length == feeds_.length, "InvalidMappingsInput");

        for (uint256 i; i < tokens_.length; i++) {
            feedMapping[tokens_[i]] = feeds_[i];
        }

        emit FeedModified(tokens_, feeds_);
    }

    function addMappings(address[] calldata addresses_, address[] calldata underlying_) external onlyGovernance {
        require(addresses_.length == underlying_.length, "InvalidMappingsInput");

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

        require(address(feedA) != address(0) && address(feedB) != address(0), "PairNotSupported");

        int8 inDecimals = _getDecimals(tokenIn_);
        int8 outDecimals = _getDecimals(tokenOut_);

        // uint256 tokenInToBase = _callRegistry(feedA);
        // uint256 tokenOutToBase = _callRegistry(feedB);

        uint256 tokenInToBase = (price1 * 10**8) / 100;
        uint256 tokenOutToBase = (price2 * 10**8) / 100;
        return _adjustDecimals((amountIn_ * tokenInToBase) / tokenOutToBase, outDecimals - inDecimals);
    }

    function _callRegistry(AggregatorV3Interface feed_) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = feed_.latestRoundData();
        require(price > 0, "InvalidPrice");
        require(updatedAt >= block.timestamp - maxDelay, "LastUpdateIsTooOld");
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
