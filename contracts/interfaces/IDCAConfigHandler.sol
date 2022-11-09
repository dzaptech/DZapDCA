// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IDCAConfigHandler {
    event SwapIntervalsUpdated(uint32[] _swapIntervals, bool indexed allowed);

    event FeeVaultUpdated(address feeVault);

    event AdminAdded(address[] accounts);

    event AdminRemoved(address[] accounts);

    event SwapFeeUpdated(uint256 feeSet);

    event PlatformFeeRatioUpdated(uint256 platformFeeRatio);

    event TokensAllowedUpdated(address[] tokens, bool allowed);

    event OracleUpdated(address oracle);

    event SlippageUpdated(uint256 slippage);

    function allowedSwapIntervals() external view returns (bytes1);

    function allowedTokens(address token_) external view returns (bool);

    function tokenMagnitude(address token_) external view returns (uint256);

    function feeVault() external view returns (address);

    function swapFee() external view returns (uint256);

    function platformFeeRatio() external view returns (uint256);

    function MAX_FEE() external view returns (uint256);

    function MAX_PLATFORM_FEE_RATIO() external view returns (uint256);

    function BPS_DENOMINATOR() external view returns (uint256);

    function ONE_INCH_ROUTER() external view returns (address);

    function pause() external;

    function unpause() external;

    function addAllowedTokens(address[] calldata tokens_) external;

    function removeAllowedTokens(address[] calldata tokens_) external;

    function addSwapIntervalsToAllowedList(uint32[] calldata swapIntervals_) external;

    function removeSwapIntervalsFromAllowedList(uint32[] calldata swapIntervals_) external;

    function setSwapFee(uint256 swapFee_) external;

    function setPlatformFeeRatio(uint256 platformFeeRatio_) external;
}
