// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./DCAConfigHandler.sol";
import "./../utils/Permitable.sol";
import "../libraries/SafeERC20.sol";
import "./../interfaces/IDCAPositionHandler.sol";

import { UserPosition, PositionInfo, PositionSet, InputPositionDetails } from "./../common/Types.sol";
import { InsufficientAmount, ZeroAddress, InvalidToken, NotNativeToken, NotWNativeToken, ZeroAmount, ZeroSwaps, UnallowedToken, InvalidRate, IntervalNotAllowed, InvalidPosition, PositionDoesNotMatchToken, ZeroSwappedAmount } from "./../common/Error.sol";

abstract contract DCAPositionHandler is Permitable, ReentrancyGuard, DCAConfigHandler, IDCAPositionHandler {
    using SafeERC20 for IERC20;

    mapping(uint256 => UserPosition) public userPositions;
    mapping(uint256 => uint256) internal _swappedBeforeModified; // positionId -> swapped amount

    uint256 public totalCreatedPositions;

    /* ========= VIEWS ========= */

    function getPositionDetails(uint256 positionId_) external view returns (PositionInfo memory positionInfo) {
        UserPosition memory userPosition = userPositions[positionId_];

        uint256 performedSwaps = swapData[userPosition.from][userPosition.to][userPosition.swapIntervalMask]
            .performedSwaps;

        positionInfo.owner = userPosition.owner;
        positionInfo.from = userPosition.from;
        positionInfo.to = userPosition.to;
        positionInfo.rate = userPosition.rate;

        positionInfo.swapsExecuted = _subtractIfPossible(
            Math.min(performedSwaps, userPosition.finalSwap),
            userPosition.swapWhereLastUpdated
        );
        positionInfo.swapsLeft = _subtractIfPossible(userPosition.finalSwap, performedSwaps);
        positionInfo.unswapped = _calculateUnswapped(userPosition, performedSwaps);

        if (userPosition.swapIntervalMask > 0) {
            positionInfo.swapInterval = Intervals.maskToInterval(userPosition.swapIntervalMask);
            positionInfo.swapped = _calculateSwapped(positionId_, userPosition, performedSwaps);
        }
    }

    /* ========= FUNCTIONS ========= */

    function createPosition(
        address from_,
        address to_,
        bytes memory permit_,
        uint256 amount_,
        uint256 noOfSwaps_,
        uint32 swapInterval_
    ) public payable nonReentrant whenNotPaused returns (uint256) {
        address fromToken = from_;

        if (from_ == NATIVE_TOKEN) {
            if (msg.value != amount_) revert InsufficientAmount();
            _wrap(amount_);
            fromToken = address(wNative);
        }

        (UserPosition memory userPosition, uint256 positionId) = _create(
            fromToken,
            to_,
            amount_,
            noOfSwaps_,
            swapInterval_
        );

        if (from_ != NATIVE_TOKEN) {
            _permit(from_, permit_);
            IERC20(from_).safeTransferFrom(_msgSender(), address(this), amount_);
        }

        emit Created(
            _msgSender(),
            positionId,
            from_,
            to_,
            swapInterval_,
            userPosition.rate,
            userPosition.swapWhereLastUpdated + 1,
            userPosition.finalSwap
        );

        return positionId;
    }

    // flag_: true for increase
    function modifyPosition(
        uint256 positionId_,
        uint256 amount_,
        uint256 newAmountOfSwaps_,
        bytes memory permit_,
        bool flag_,
        bool nativeFlag_
    ) external payable whenNotPaused {
        UserPosition memory userPosition = userPositions[positionId_];
        _assertTokensAreAllowed(userPosition.from, userPosition.to);

        if (nativeFlag_) {
            if (userPosition.from != address(wNative)) revert NotNativeToken();

            if (flag_) {
                if (msg.value != amount_) revert InsufficientAmount();
                _wrap(amount_);
            }
        }

        (uint256 rate, uint256 startingSwap, uint256 finalSwap) = _modify(
            userPosition,
            positionId_,
            amount_,
            newAmountOfSwaps_,
            flag_
        );

        if (flag_ && !nativeFlag_) {
            _permit(userPosition.from, permit_);

            IERC20(userPosition.from).safeTransferFrom(_msgSender(), address(this), amount_);
        } else if (!flag_) {
            if (nativeFlag_) {
                _unwrapAndSend(amount_, payable(_msgSender()));
            } else {
                IERC20(userPosition.from).safeTransfer(_msgSender(), amount_);
            }
        }

        emit Modified(_msgSender(), positionId_, rate, startingSwap, finalSwap);
    }

    function terminate(
        uint256 positionId_,
        address payable recipientSwapped_,
        address payable recipientUnswapped_,
        bool nativeFlag_
    ) external nonReentrant {
        if (recipientUnswapped_ == address(0) || recipientSwapped_ == address(0)) revert ZeroAddress();

        UserPosition memory userPosition = userPositions[positionId_];

        if (nativeFlag_ && userPosition.from != address(wNative) && userPosition.to != address(wNative))
            revert NotWNativeToken();

        (uint256 unswapped, uint256 swapped) = _terminate(userPosition, positionId_);

        if (unswapped > 0) {
            if (nativeFlag_ && userPosition.from == address(wNative)) _unwrapAndSend(unswapped, recipientUnswapped_);
            else IERC20(userPosition.from).safeTransfer(recipientUnswapped_, unswapped);
        }

        if (swapped > 0) {
            if (nativeFlag_ && userPosition.to == address(wNative)) _unwrapAndSend(swapped, recipientSwapped_);
            else IERC20(userPosition.to).safeTransfer(recipientSwapped_, swapped);
        }

        emit Terminated(_msgSender(), recipientSwapped_, recipientUnswapped_, positionId_, swapped, unswapped);
    }

    function withdrawSwapped(
        uint256 positionId_,
        address payable recipient_,
        bool nativeFlag_
    ) external {
        _assertNonZeroAddress(recipient_);
        UserPosition memory userPosition = userPositions[positionId_];

        if (nativeFlag_ && userPosition.to != address(wNative)) revert NotWNativeToken();

        uint256 swapped = _executeWithdraw(userPosition, positionId_);

        if (swapped == 0) revert ZeroSwappedAmount();

        if (nativeFlag_) {
            _unwrapAndSend(swapped, recipient_);
        } else {
            IERC20(userPosition.to).safeTransfer(recipient_, swapped);
        }

        emit Withdrew(_msgSender(), recipient_, positionId_, userPosition.to, swapped);
    }

    /* ========= INTERNAL ========= */

    function _create(
        address from_,
        address to_,
        uint256 amount_,
        uint256 noOfSwaps_,
        uint32 swapInterval_
    ) private returns (UserPosition memory, uint256) {
        if (from_ == address(0) || to_ == address(0)) revert ZeroAddress();
        if (from_ == to_) revert InvalidToken();
        if (amount_ == 0) revert ZeroAmount();
        if (noOfSwaps_ == 0) revert ZeroSwaps();

        _assertTokensAreAllowed(from_, to_);

        bytes1 swapIntervalMask = Intervals.intervalToMask(swapInterval_);
        if (allowedSwapIntervals & swapIntervalMask == 0) revert IntervalNotAllowed();

        uint256 rate = _calculateRate(amount_, noOfSwaps_);
        if (rate <= 0) revert InvalidRate();

        uint256 positionId = ++totalCreatedPositions;
        uint256 performedSwaps = swapData[from_][to_][swapIntervalMask].performedSwaps;

        UserPosition memory userPosition = UserPosition({
            swapWhereLastUpdated: performedSwaps,
            finalSwap: performedSwaps + noOfSwaps_,
            swapIntervalMask: swapIntervalMask,
            from: from_,
            to: to_,
            rate: rate,
            owner: _msgSender()
        });

        // updateActiveIntervals
        if (activeSwapIntervals[from_][to_] & swapIntervalMask == 0) {
            activeSwapIntervals[from_][to_] |= swapIntervalMask;
        }

        _addToDelta(userPosition);
        userPositions[positionId] = userPosition;

        return (userPosition, positionId);
    }

    function _modify(
        UserPosition memory userPosition_,
        uint256 positionId_,
        uint256 amount_,
        uint256 newAmountOfSwaps_,
        bool increase_
    )
        private
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        if (amount_ == 0) revert ZeroAmount();
        if (newAmountOfSwaps_ == 0) revert ZeroSwaps();

        _assertPositionExistsAndCallerHasPermission(userPosition_);

        uint256 performedSwaps = swapData[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask]
            .performedSwaps;
        uint256 unswapped = _calculateUnswapped(userPosition_, performedSwaps);

        uint256 newTotal = increase_ ? unswapped + amount_ : unswapped - amount_;

        uint256 newRate = _calculateRate(newTotal, newAmountOfSwaps_);
        if (newTotal == 0 && newAmountOfSwaps_ > 0) newAmountOfSwaps_ = 0;

        uint256 newFinalSwap = performedSwaps + newAmountOfSwaps_;

        userPositions[positionId_].rate = newRate;
        userPositions[positionId_].finalSwap = newFinalSwap;
        userPositions[positionId_].swapWhereLastUpdated = performedSwaps;
        _swappedBeforeModified[positionId_] = _calculateSwapped(positionId_, userPosition_, performedSwaps);

        _removeFromDelta(userPosition_, performedSwaps);
        _addToDelta(userPositions[positionId_]);

        return (newRate, performedSwaps + 1, newFinalSwap);
    }

    function _terminate(UserPosition memory userPosition_, uint256 positionId_)
        private
        returns (uint256 unswapped, uint256 swapped)
    {
        _assertPositionExistsAndCallerHasPermission(userPosition_);

        uint256 performedSwaps = swapData[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask]
            .performedSwaps;

        swapped = _calculateSwapped(positionId_, userPosition_, performedSwaps);
        unswapped = _calculateUnswapped(userPosition_, performedSwaps);

        // removeFromDelta
        _removeFromDelta(userPosition_, performedSwaps);

        delete userPositions[positionId_]; // userPositions[positionId_].terminated = true;
        _swappedBeforeModified[positionId_] = 0;
    }

    function _addToDelta(UserPosition memory userPosition_) internal {
        swapData[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask].nextAmountToSwap += userPosition_
            .rate;
        swapAmountDelta[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask][
            userPosition_.finalSwap + 1
        ] += userPosition_.rate;
    }

    function _removeFromDelta(UserPosition memory userPosition_, uint256 performedSwaps_) internal {
        if (userPosition_.finalSwap > performedSwaps_) {
            swapData[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask]
                .nextAmountToSwap -= userPosition_.rate;
            swapAmountDelta[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask][
                userPosition_.finalSwap + 1
            ] -= userPosition_.rate;
        }
    }

    function _calculateSwapped(
        uint256 positionId_,
        UserPosition memory userPosition_,
        uint256 performedSwaps_
    ) internal view returns (uint256) {
        uint256 swapNumber = Math.min(performedSwaps_, userPosition_.finalSwap);

        if (userPosition_.swapWhereLastUpdated > swapNumber) {
            // If last update happened after the position's final swap, then a withdraw was executed, and we just return 0
            return 0;
        } else if (userPosition_.swapWhereLastUpdated == swapNumber) {
            // If the last update matches the positions's final swap, then we can avoid all calculation below
            return _swappedBeforeModified[positionId_];
        }

        // in B
        uint256 accumRatio = accumRatio[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask][
            swapNumber
        ] -
            accumRatio[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask][
                userPosition_.swapWhereLastUpdated
            ];

        return
            ((accumRatio * userPosition_.rate) / tokenMagnitude[userPosition_.from]) +
            _swappedBeforeModified[positionId_];
    }

    function _calculateUnswapped(UserPosition memory userPosition_, uint256 performedSwaps_)
        internal
        pure
        returns (uint256)
    {
        return _subtractIfPossible(userPosition_.finalSwap, performedSwaps_) * userPosition_.rate;
    }

    function _executeWithdraw(UserPosition memory userPosition_, uint256 positionId_) internal returns (uint256) {
        _assertPositionExistsAndCallerHasPermission(userPosition_);

        uint256 performedSwaps = swapData[userPosition_.from][userPosition_.to][userPosition_.swapIntervalMask]
            .performedSwaps;

        uint256 swapped = _calculateSwapped(positionId_, userPosition_, performedSwaps);

        userPositions[positionId_].swapWhereLastUpdated = performedSwaps;
        _swappedBeforeModified[positionId_] = 0;

        return swapped;
    }

    function _calculateRate(uint256 amount_, uint256 noOfSwaps_) internal pure returns (uint256) {
        return amount_ / noOfSwaps_;
    }

    function _calculateFeeForAmount(uint256 _amount) internal view returns (uint256) {
        return (_amount * swapFee) / BPS_DENOMINATOR;
    }

    function _unwrapAndSend(uint256 amount_, address payable recipient_) internal {
        if (amount_ > 0) {
            wNative.withdraw(amount_);
            recipient_.transfer(amount_);
        }
    }

    function _wrapAndTransfer(uint256 amount_, address recipient_) internal {
        if (amount_ > 0) {
            wNative.deposit{ value: amount_ }();
            wNative.transfer(recipient_, amount_);
        }
    }

    function _wrap(uint256 amount_) internal {
        if (amount_ > 0) {
            wNative.deposit{ value: amount_ }();
        }
    }

    // ========== ASSERT =================

    function _assertNonZeroAddress(address recipient_) internal pure {
        if (recipient_ == address(0)) revert ZeroAddress();
    }

    function _assertTokensAreAllowed(address tokenA_, address tokenB_) internal view {
        if (!allowedTokens[tokenA_] || !allowedTokens[tokenB_]) revert UnallowedToken();
    }

    function _assertPositionExistsAndCallerHasPermission(UserPosition memory userPosition_) internal view {
        if (userPosition_.swapIntervalMask == 0) revert InvalidPosition();
        if (_msgSender() != userPosition_.owner) revert UnauthorizedCaller();
    }

    // ========== LIBRARY TYPE FUNCTIONS =================

    function _subtractIfPossible(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return a_ > b_ ? a_ - b_ : 0;
    }
}
