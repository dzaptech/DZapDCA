// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./DCAConfigHandlerMock.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/IDCASwapHandler.sol";
import { IAggregationRouterV4 } from "../../interfaces/IAggregationRouterV4.sol";
import { SwapInfo, Pair, SwapDetails } from "../../common/Types.sol";

abstract contract DCASwapHandlerMock is ReentrancyGuard, DCAConfigHandlerMock, IDCASwapHandler {
    using SafeERC20 for IERC20;

    uint256 internal constant _PARTIAL_FILL = 1 << 0;
    address public immutable ONE_INCH_ROUTER;

    constructor(address oneInchRouter_) {
        ONE_INCH_ROUTER = oneInchRouter_;
    }

    /* ========= VIEWS ========= */

    function secondsUntilNextSwap(Pair[] calldata pairs_) external view returns (uint256[] memory) {
        uint256[] memory secondsArr = new uint256[](pairs_.length);
        for (uint256 i; i < pairs_.length; i++) {
            secondsArr[i] = _secondsUntilNextSwap(pairs_[i].from, pairs_[i].to);
        }
        return secondsArr;
    }

    function getNextSwapInfo(Pair[] calldata pairs_) external view returns (SwapInfo[] memory) {
        SwapInfo[] memory swapInformation = new SwapInfo[](pairs_.length);

        for (uint256 i; i < pairs_.length; ++i) {
            Pair memory pair = pairs_[i];

            (uint256 totalAmountToSwap, bytes1 intervalsInSwap) = _getTotalAmountsToSwap(pair.from, pair.to);

            (uint256 amountToSwap, uint256 feeAmount) = _calculateFeeAmount(totalAmountToSwap, swapFee);

            (uint256 swapReward, uint256 platformFee) = _calculateFeeAmount(feeAmount, platformFeeRatio);

            uint256 returnAmount = oracle.quote(pair.from, amountToSwap, pair.to);

            swapInformation[i] = SwapInfo(
                pair.from,
                pair.to,
                amountToSwap,
                returnAmount,
                swapReward,
                platformFee,
                intervalsInSwap
            );
        }

        return swapInformation;
    }

    function getQuote(
        address tokenIn_,
        uint256 amountIn_,
        address tokenOut_
    ) public view returns (uint256 amountOut) {
        amountOut = oracle.quote(tokenIn_, amountIn_, tokenOut_);
        amountOut -= (amountOut * slippage) / BPS_DENOMINATOR;
    }

    /* ========= PUBLIC ========= */

    // swap using 1inch
    function swap(SwapDetails[] calldata data_, address rewardRecipient_)
        public
        nonReentrant
        whenNotPaused
        returns (SwapInfo[] memory)
    {
        require(data_.length > 0, "InvalidLength");
        SwapInfo[] memory swapInformation = new SwapInfo[](data_.length);

        for (uint256 i; i < data_.length; ++i) {
            SwapDetails memory data = data_[i];

            require(data.desc.dstReceiver == address(0), "InvalidDstReceiver");
            require(data.desc.flags & _PARTIAL_FILL == 0, "PartialFillNotAllowed");

            address srcToken = address(data.desc.srcToken);
            address dstToken = address(data.desc.dstToken);

            (uint256 totalAmountToSwap, bytes1 intervalsInSwap) = _getTotalAmountsToSwap(srcToken, dstToken);
            (uint256 amountToSwap, uint256 feeAmount) = _calculateFeeAmount(totalAmountToSwap, swapFee);

            require(amountToSwap > 0 && intervalsInSwap > 0, "NoAvailableSwap");

            require(data.desc.amount == amountToSwap, "InvalidSwapAmount");

            uint256 neededInSwap = getQuote(srcToken, amountToSwap, dstToken);

            // approve
            data.desc.srcToken.safeIncreaseAllowance(address(mockExchange), data.desc.amount + 1);

            // execute swap
            // (uint256 returnAmount, ) = IAggregationRouterV4(ONE_INCH_ROUTER).swap(
            //     data.executor,
            //     data.desc,
            //     data.routeData
            // );

            // execute mock swap
            (uint256 returnAmount, ) = mockExchange.swap(data.desc.srcToken, data.desc.dstToken, data.desc.amount);

            require(returnAmount >= neededInSwap && returnAmount >= data.desc.minReturnAmount, "InvalidReturnAmount");

            // register swap
            _registerSwap(srcToken, dstToken, totalAmountToSwap, returnAmount, intervalsInSwap);

            // reward and platformFeeCalculation
            (uint256 swapReward, uint256 platformFee) = _calculateFeeAmount(feeAmount, platformFeeRatio);

            swapInformation[i] = SwapInfo(
                srcToken,
                dstToken,
                amountToSwap,
                returnAmount,
                swapReward,
                platformFee,
                intervalsInSwap
            );

            // transfer reward and fee
            if (platformFee > 0) data.desc.srcToken.safeTransfer(feeVault, platformFee);
            if (swapReward > 0) data.desc.srcToken.safeTransfer(rewardRecipient_, swapReward);
        }

        emit Swapped(_msgSender(), rewardRecipient_, swapInformation, swapFee);

        return swapInformation;
    }

    /* ========= INTERNAL ========= */

    function _calculateFeeAmount(uint256 amount_, uint256 fee_) internal pure returns (uint256, uint256) {
        uint256 feeAmount = (amount_ * fee_) / BPS_DENOMINATOR;
        return (amount_ - feeAmount, feeAmount);
    }

    function _getSwapPrice(
        uint256 amountA_,
        uint256 amountB_,
        uint256 magnitudeA_
    ) internal pure returns (uint256) {
        return (amountB_ * magnitudeA_) / amountA_;
    }

    function _getTotalAmountsToSwap(address from_, address to_)
        internal
        view
        virtual
        returns (uint256 totalAmountToSwap, bytes1 intervalsInSwap)
    {
        bytes1 activeIntervalsMem = activeSwapIntervals[from_][to_];
        bytes1 mask = 0x01;

        while (activeIntervalsMem >= mask && mask > 0) {
            if (activeIntervalsMem & mask != 0) {
                SwapData memory swapDataMem = swapData[from_][to_][mask];
                uint32 swapInterval = Intervals.maskToInterval(mask);

                if (((swapDataMem.lastSwappedAt / swapInterval) + 1) * swapInterval > block.timestamp) {
                    // Note: this 'break' is both an optimization and a search for more CoW. Since this loop starts with the smaller intervals, it is
                    // highly unlikely that if a small interval can't be swapped, a bigger interval can. It could only happen when a position was just
                    // created for a new swap interval. At the same time, by adding this check, we force intervals to be swapped together.
                    break;
                }

                intervalsInSwap |= mask;
                totalAmountToSwap += swapDataMem.nextAmountToSwap;
            }

            mask <<= 1;
        }

        if (totalAmountToSwap == 0) {
            intervalsInSwap = 0;
        }
    }

    function _registerSwap(
        address tokenA_,
        address tokenB_,
        uint256 totalAmountToSwap_,
        uint256 returnAmount_,
        bytes1 intervalsInSwap_
    ) internal {
        uint256 swapPrice = _getSwapPrice(totalAmountToSwap_, returnAmount_, tokenMagnitude[tokenA_]);

        bytes1 mask = 0x01;
        while (intervalsInSwap_ >= mask && mask != 0) {
            if (intervalsInSwap_ & mask != 0) {
                SwapData memory swapDataMem = swapData[tokenA_][tokenB_][mask];
                if (swapDataMem.nextAmountToSwap > 0) {
                    accumRatio[tokenA_][tokenB_][mask][swapDataMem.performedSwaps + 1] =
                        accumRatio[tokenA_][tokenB_][mask][swapDataMem.performedSwaps] +
                        swapPrice;

                    swapData[tokenA_][tokenB_][mask] = SwapData(
                        swapDataMem.performedSwaps + 1,
                        swapDataMem.nextAmountToSwap -
                            swapAmountDelta[tokenA_][tokenB_][mask][swapDataMem.performedSwaps + 2],
                        block.timestamp
                    );

                    // swapAmountDelta[tokenA_][tokenB_][mask][
                    //     swapDataMem.performedSwaps + 2
                    // ] = 0;
                } else {
                    activeSwapIntervals[tokenA_][tokenB_] &= ~mask;
                }
            }

            mask <<= 1;
        }
    }

    function _secondsUntilNextSwap(address from_, address to_) internal view returns (uint256) {
        bytes1 activeIntervals = activeSwapIntervals[from_][to_];
        bytes1 mask = 0x01;
        uint256 smallerIntervalBlocking;

        while (activeIntervals >= mask && mask > 0) {
            if (activeIntervals & mask == mask) {
                SwapData memory swapDataMem = swapData[from_][to_][mask];
                uint32 swapInterval = Intervals.maskToInterval(mask);
                uint256 nextAvailable = ((swapDataMem.lastSwappedAt / swapInterval) + 1) * swapInterval;

                if (swapDataMem.nextAmountToSwap > 0) {
                    if (nextAvailable <= block.timestamp) {
                        return smallerIntervalBlocking;
                    } else {
                        return nextAvailable - block.timestamp;
                    }
                } else if (nextAvailable > block.timestamp) {
                    smallerIntervalBlocking = smallerIntervalBlocking == 0
                        ? nextAvailable - block.timestamp
                        : smallerIntervalBlocking;
                }
            }
            mask <<= 1;
        }
        return type(uint256).max;
    }
}
