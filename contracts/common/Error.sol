// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/// @notice Thrown when trying to interact with an unallowed token
error UnallowedToken();

/// @notice Thrown when trying to set a fee higher than the maximum allowed
error HighFee();

/// @notice Thrown when trying to set a fee ratio that is higher that the maximum allowed
error HighPlatformFeeRatio();

/// @notice Thrown when a user tries to create a position with the same `from` & `to`
error InvalidToken();

error NotNativeToken();

error NotWNativeToken();

/// @notice Thrown when a user tries to create a position with a swap interval that is not allowed
error IntervalNotAllowed();

/// @notice Thrown when a user tries operate on a position that doesn't exist (it might have been already terminated)
error InvalidPosition();

/// @notice Thrown when a user tries operate on a position that they don't have access to
error UnauthorizedCaller();

/// @notice Thrown when a user tries to create a position with zero swaps
error ZeroSwaps();

/// @notice Thrown when a user tries to create a position with zero funds
error ZeroAmount();

/// @notice Thrown when a user tries to withdraw a position whose `to` token doesn't match the specified one
error PositionDoesNotMatchToken();

/// @notice Thrown when one of the parameters is a zero address
error ZeroAddress();

/// @notice Thrown when a user tries convert and invalid interval to a byte representation
error InvalidInterval();

/// @notice Thrown when a user tries convert and invalid byte representation to an interval
error InvalidMask();

error InvalidRate();

error InvalidPermitType();

error InvalidPermit();

error InvalidDstReceiver();

error PartialFillNotAllowed();

error NoAvailableSwap();

error InvalidSwapAmount();

error InvalidReturnAmount();

error ZeroSwappedAmount();

error InvalidPrice();

error LastUpdateIsTooOld();

error ZeroMaxDelay();

error PairNotSupported();

error InvalidMappingsInput();

error InsufficientAmount();
