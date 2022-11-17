// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/Pausable.sol";

import "../DCAParametersMock.sol";
import "../MockOracle.sol";
import "../MockExchange.sol";
import "../../utils/Governable.sol";
import "../../libraries/Intervals.sol";
import "../../interfaces/IERC20.sol";
import "../../interfaces/IDCAConfigHandler.sol";
import { IWNative } from "../../interfaces/IWNative.sol";

abstract contract DCAConfigHandlerMock is DCAParametersMock, Governable, Pausable, IDCAConfigHandler {
    /// if a interval is currently allowed or not, can also give default
    bytes1 public allowedSwapIntervals;

    // if a token is currently allowed or not
    mapping(address => bool) public allowedTokens;

    // token's magnitude (10**decimals)
    mapping(address => uint256) public tokenMagnitude;

    mapping(address => bool) public admins;

    IWNative public immutable wNative;

    address public feeVault;

    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// the fee charged on swaps (in BPS, ie mul by 100)
    uint256 public swapFee;

    /// how much will the platform take from the fees collected in swaps (in BPS)
    uint256 public platformFeeRatio;

    MockOracle public oracle;
    MockExchange public mockExchange;

    uint256 public slippage;

    uint256 public constant MAX_SLIPPAGE = 500; // 5%
    uint256 public constant MAX_FEE = 1000; // 10%
    uint256 public constant MAX_PLATFORM_FEE_RATIO = 10000; // 100%
    uint256 public constant BPS_DENOMINATOR = 10000; // 2 point precision

    /* ========= CONSTRUCTOR ========= */

    constructor(
        address governor_,
        address wNative_,
        address mockOracle_,
        address mockExchange_,
        address feeVault_,
        uint256 slippage_
    ) Governable(governor_) {
        require(slippage_ <= MAX_SLIPPAGE, "InvalidSlippage");
        require(feeVault_ != address(0) && wNative_ != address(0), "ZeroAddress");

        feeVault = feeVault_;
        wNative = IWNative(wNative_);
        oracle = MockOracle(mockOracle_);
        mockExchange = MockExchange(mockExchange_);

        slippage = slippage_;
    }

    /* ========== MODIFIERS ==========  */

    modifier onlyAdminOrGovernor() {
        require(admins[_msgSender()] || _msgSender() == governance(), "UnauthorizedCaller");
        _;
    }

    /* ========= RESTRICTED FUNCTIONS ========= */

    function addAdmins(address[] calldata accounts_) external onlyGovernance {
        _setAdmin(accounts_, true);

        emit AdminAdded(accounts_);
    }

    function removeAdmins(address[] calldata accounts_) external onlyGovernance {
        _setAdmin(accounts_, false);

        emit AdminRemoved(accounts_);
    }

    function pause() external onlyGovernance {
        _pause();
    }

    function unpause() external onlyGovernance {
        _unpause();
    }

    function addAllowedTokens(address[] calldata tokens_) external onlyAdminOrGovernor {
        _setAllowedTokens(tokens_, true);
    }

    function removeAllowedTokens(address[] calldata tokens_) external onlyAdminOrGovernor {
        _setAllowedTokens(tokens_, false);
    }

    function addSwapIntervalsToAllowedList(uint32[] calldata swapIntervals_) external onlyAdminOrGovernor {
        for (uint256 i; i < swapIntervals_.length; ++i) {
            allowedSwapIntervals |= Intervals.intervalToMask(swapIntervals_[i]);
        }

        emit SwapIntervalsUpdated(swapIntervals_, true);
    }

    function removeSwapIntervalsFromAllowedList(uint32[] calldata swapIntervals_) external onlyAdminOrGovernor {
        for (uint256 i; i < swapIntervals_.length; ++i) {
            allowedSwapIntervals &= ~Intervals.intervalToMask(swapIntervals_[i]);
        }
        emit SwapIntervalsUpdated(swapIntervals_, false);
    }

    function setFeeVault(address newVault_) external onlyGovernance {
        require(newVault_ != address(0), "ZeroAddress");

        feeVault = newVault_;

        emit FeeVaultUpdated(newVault_);
    }

    function setSwapFee(uint256 swapFee_) external onlyAdminOrGovernor {
        require(swapFee_ <= MAX_FEE, "HighFee");
        swapFee = swapFee_;

        emit SwapFeeUpdated(swapFee_);
    }

    function setPlatformFeeRatio(uint256 platformFeeRatio_) external onlyAdminOrGovernor {
        require(platformFeeRatio_ <= MAX_PLATFORM_FEE_RATIO, "HighPlatformFeeRatio");
        platformFeeRatio = platformFeeRatio_;

        emit PlatformFeeRatioUpdated(platformFeeRatio_);
    }

    function setOracle(address oracle_) external onlyGovernance {
        require(oracle_ != address(0), "ZeroAddress");

        oracle = MockOracle(oracle_);

        emit OracleUpdated(oracle_);
    }

    function setSlippage(uint256 newSlippage_) external onlyAdminOrGovernor {
        require(newSlippage_ <= MAX_SLIPPAGE, "InvalidSlippage");
        slippage = newSlippage_;

        emit SlippageUpdated(newSlippage_);
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

    function _setAdmin(address[] calldata accounts_, bool state_) private {
        for (uint256 i; i < accounts_.length; i++) {
            require(accounts_[i] != address(0), "ZeroAddress");
            admins[accounts_[i]] = state_;
        }
    }
}
