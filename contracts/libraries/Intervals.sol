// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { InvalidInterval, InvalidMask } from "./../common/Error.sol";

/// @title Intervals library
/// @notice Provides functions to easily convert from swap intervals to their byte representation and viceversa
library Intervals {
    /// @notice Takes a swap interval and returns its byte representation
    /// @dev Will revert with InvalidInterval if the swap interval is not valid
    /// @param swapInterval_ The swap interval
    /// @return The interval's byte representation
    function intervalToMask(uint32 swapInterval_) internal pure returns (bytes1) {
        if (swapInterval_ == 1 hours) return 0x01;
        if (swapInterval_ == 4 hours) return 0x02;
        if (swapInterval_ == 12 hours) return 0x04;
        if (swapInterval_ == 1 days) return 0x08;
        if (swapInterval_ == 3 days) return 0x10;
        if (swapInterval_ == 1 weeks) return 0x20;
        if (swapInterval_ == 2 weeks) return 0x40;
        if (swapInterval_ == 30 days) return 0x80;
        revert InvalidInterval();
    }

    /// @notice Takes a byte representation of a swap interval and returns the swap interval
    /// @dev Will revert with InvalidMask if the byte representation is not valid
    /// @param mask_ The byte representation
    /// @return The swap interval
    function maskToInterval(bytes1 mask_) internal pure returns (uint32) {
        if (mask_ == 0x01) return 1 hours;
        if (mask_ == 0x02) return 4 hours;
        if (mask_ == 0x04) return 12 hours;
        if (mask_ == 0x08) return 1 days;
        if (mask_ == 0x10) return 3 days;
        if (mask_ == 0x20) return 1 weeks;
        if (mask_ == 0x40) return 2 weeks;
        if (mask_ == 0x80) return 30 days;
        revert InvalidMask();
    }

    /// @notice Takes a byte representation of a set of swap intervals and returns which ones are in the set
    /// @dev Will always return an array of length 8, with zeros at the end if there are less than 8 intervals
    /// @param byte_ The byte representation
    /// @return intervals The swap intervals in the set
    function intervalsInByte(bytes1 byte_) internal pure returns (uint32[] memory intervals) {
        intervals = new uint32[](8);
        uint8 _index;
        bytes1 mask_ = 0x01;
        while (byte_ >= mask_ && mask_ > 0) {
            if (byte_ & mask_ != 0) {
                intervals[_index++] = maskToInterval(mask_);
            }
            mask_ <<= 1;
        }
    }
}
