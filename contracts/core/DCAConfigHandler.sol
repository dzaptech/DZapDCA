// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/Pausable.sol";

import "./DCAParameters.sol";
import "./../utils/Governable.sol";
import "./../libraries/Intervals.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IDCAConfigHandler.sol";
import "../interfaces/IChainlinkOracle.sol";
import { IWNative } from "./../interfaces/IWNative.sol";

abstract contract DCAConfigHandler is DCAParameters, Governable, Pausable, IDCAConfigHandler {
    /// if a interval is currently allowed or not, can also give default
    bytes1 public allowedSwapIntervals;

    // if a token is currently allowed or not
    mapping(address => bool) public allowedTokens;

    // token's magnitude (10**decimals)
    mapping(address => uint256) public tokenMagnitude;

    IWNative public immutable wNative;

    address public feeVault;

    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// the fee charged on swaps (in BPS, ie mul by 100)
    uint256 public swapFee;

    /// how much will the platform take from the fees collected in swaps (in BPS)
    uint256 public platformFeeRatio;

    IChainlinkOracle public oracle;

    uint256 public constant MAX_FEE = 10000; // 10%
    uint256 public constant MAX_PLATFORM_FEE_RATIO = 100000; // 100%
    uint256 public constant BPS_DENOMINATOR = 100000; // 3 point precision

    /* ========= CONSTRUCTOR ========= */

    constructor(
        address governor_,
        address wNative_,
        address oracle_
    ) Governable(governor_) {
        wNative = IWNative(wNative_);
        oracle = IChainlinkOracle(oracle_);
    }

    /* ========= RESTRICTED FUNCTIONS ========= */

    function pause() external onlyGovernance {
        _pause();
    }

    function unpause() external onlyGovernance {
        _unpause();
    }

    function addAllowedTokens(address[] calldata tokens_) external onlyGovernance {
        _setAllowedTokens(tokens_, true);
    }

    function removeAllowedTokens(address[] calldata tokens_) external onlyGovernance {
        _setAllowedTokens(tokens_, false);
    }

    function addSwapIntervalsToAllowedList(uint32[] calldata swapIntervals_) external onlyGovernance {
        for (uint256 i; i < swapIntervals_.length; ++i) {
            allowedSwapIntervals |= Intervals.intervalToMask(swapIntervals_[i]);
        }

        emit SwapIntervalsUpdated(swapIntervals_, true);
    }

    function removeSwapIntervalsFromAllowedList(uint32[] calldata swapIntervals_) external onlyGovernance {
        for (uint256 i; i < swapIntervals_.length; ++i) {
            allowedSwapIntervals &= ~Intervals.intervalToMask(swapIntervals_[i]);
        }
        emit SwapIntervalsUpdated(swapIntervals_, false);
    }

    function setFeeVault(address newVault_) external onlyGovernance {
        feeVault = newVault_;

        emit FeeVaultUpdated(newVault_);
    }

    function setSwapFee(uint256 swapFee_) external onlyGovernance {
        require(swapFee_ <= MAX_FEE, "HighFee");
        swapFee = swapFee_;

        emit SwapFeeUpdated(swapFee_);
    }

    function setPlatformFeeRatio(uint256 platformFeeRatio_) external onlyGovernance {
        require(platformFeeRatio_ <= MAX_PLATFORM_FEE_RATIO, "HighPlatformFeeRatio");
        platformFeeRatio = platformFeeRatio_;

        emit PlatformFeeRatioUpdated(platformFeeRatio_);
    }

    function _setAllowedTokens(address[] calldata tokens_, bool allowed_) internal {
        for (uint256 i; i < tokens_.length; ++i) {
            address token = tokens_[i];
            allowedTokens[token] = allowed_;
            if (tokenMagnitude[token] == 0) {
                tokenMagnitude[token] = 10**IERC20(token).decimals();
            }
        }

        emit TokensAllowedUpdated(tokens_, allowed_);
    }
}
