// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { UserPosition, PositionInfo, PositionSet } from "./../common/Types.sol";

interface IDCAPositionHandler {
    /// @notice Emitted when a position is created
    /// @param owner The address of the user that will own the position
    /// @param positionId The id of the position that was created
    /// @param fromToken The address of the "from" token
    /// @param toToken The address of the "to" token
    /// @param swapInterval How frequently the position's swaps should be executed
    /// @param rate How many "from" tokens need to be traded in each swap
    /// @param startingSwap The number of the swap when the position will be executed for the first time
    /// @param finalSwap The number of the swap when the position will be executed for the last time
    event Deposited(
        address indexed owner,
        uint256 positionId,
        address fromToken,
        address toToken,
        uint256 swapInterval,
        uint256 rate,
        uint256 startingSwap,
        uint256 finalSwap
    );

    /// @notice Emitted when a user withdraws all swapped tokens from a position
    /// @param withdrawer The address of the user that executed the withdraw
    /// @param recipient The address of the user that will receive the withdrawn tokens
    /// @param positionId The id of the position that was affected
    /// @param token The address of the withdrawn tokens. It's the same as the position's "to" token
    /// @param amount The amount that was withdrawn
    event Withdrew(
        address indexed withdrawer,
        address indexed recipient,
        uint256 positionId,
        address token,
        uint256 amount
    );

    event WithdrewAndSwapped(
        address indexed withdrawer,
        address indexed recipient,
        address srcToken,
        address destToken,
        uint256 leftOver,
        uint256 returnAmount
    );

    /// @notice Emitted when a position is modified
    /// @param user The address of the user that modified the position
    /// @param positionId The id of the position that was modified
    /// @param rate How many "from" tokens need to be traded in each swap
    /// @param startingSwap The number of the swap when the position will be executed for the first time
    /// @param finalSwap The number of the swap when the position will be executed for the last time
    event Modified(address indexed user, uint256 positionId, uint256 rate, uint256 startingSwap, uint256 finalSwap);

    /// @notice Emitted when a position is terminated
    /// @param user The address of the user that terminated the position
    /// @param recipientUnswapped The address of the user that will receive the unswapped tokens
    /// @param recipientSwapped The address of the user that will receive the swapped tokens
    /// @param positionId The id of the position that was terminated
    /// @param returnedUnswapped How many "from" tokens were returned to the caller
    /// @param returnedSwapped How many "to" tokens were returned to the caller
    event Terminated(
        address indexed user,
        address indexed recipientSwapped,
        address indexed recipientUnswapped,
        uint256 positionId,
        uint256 returnedSwapped,
        uint256 returnedUnswapped
    );

    // function userPositions(uint256 positionId_)
    //     external
    //     returns (UserPosition memory);

    function totalCreatedPositions() external view returns (uint256);

    function getPositionDetails(uint256 positionId_) external view returns (PositionInfo memory positionInfo);

    function createPosition(
        address from_,
        address to_,
        bytes memory permit_,
        uint256 amount_,
        uint256 noOfSwaps_,
        uint32 swapInterval_
    ) external returns (uint256);

    function increasePosition(
        uint256 positionId_,
        uint256 amount_,
        uint256 newAmountOfSwaps_,
        bytes memory permit_
    ) external;

    function reducePosition(
        uint256 positionId_,
        uint256 amount_,
        uint256 newAmountOfSwaps_,
        address recipient_
    ) external;

    function terminate(
        uint256 positionId_,
        address recipientSwapped_,
        address recipientUnswapped_
    ) external;

    function withdrawSwapped(uint256 positionId_, address recipient_) external;
}
