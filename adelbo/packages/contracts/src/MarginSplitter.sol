// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITravelVault {
    function deposit(address user, uint256 amount) external;
}

interface IRewardPool {
    function contribute(address user, uint256 amount) external;
}

interface IReputation {
    function recordBooking(address user, bool isWld) external;
}

/**
 * @title MarginSplitter
 * @notice Entry point for all Adelbo bookings. Accepts USDC and splits the
 *         margin atomically: 1.75% company, 1.25% Travel Credit vault, 2% Pool.
 *         Supports fiat-backed (backend-triggered) and direct USDC/WLD payments.
 * @dev USDC on World Chain uses 6 decimals.
 */
contract MarginSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    ITravelVault public travelVault;
    IRewardPool public rewardPool;
    IReputation public reputation;

    address public companyTreasury;
    address public authorizedBackend;
    address public authorizedCREWorker;

    // Margin split: 500 = 5% total
    uint256 public constant TOTAL_MARGIN_BPS = 500;     // 5%
    uint256 public constant COMPANY_BPS = 175;          // 1.75%
    uint256 public constant TRAVEL_CREDIT_BPS = 125;    // 1.25%
    uint256 public constant POOL_BPS = 200;             // 2%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public bookingCount;

    uint256 public wldUsdPrice; // WLD/USD price with 8 decimals (e.g. 2.50 USD = 250000000)
    address public priceOracle; // authorized CRE price oracle address

    struct Booking {
        bytes32 bookingId;
        address user;
        uint256 totalAmount;      // gross amount (base + 5% margin)
        uint256 companyAmount;    // 1.75%
        uint256 travelCreditAmount; // 1.25%
        uint256 poolAmount;       // 2%
        string paymentMethod;     // "card" | "usdc" | "wld"
        string stripePaymentIntentId;
        bool completed;
        uint256 timestamp;
    }

    mapping(bytes32 => Booking) public bookings;
    mapping(bytes32 => bool) public processedBookings;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BookingProcessed(
        bytes32 indexed bookingId,
        address indexed user,
        uint256 totalAmount,
        uint256 companyAmount,
        uint256 travelCreditAmount,
        uint256 poolAmount,
        string paymentMethod
    );

    event BookingCompleted(bytes32 indexed bookingId, address indexed user);
    event WldPriceUpdated(uint256 newPrice, address updatedBy);
    event BackendUpdated(address indexed newBackend);
    event CREWorkerUpdated(address indexed newWorker);
    event TreasuryUpdated(address indexed newTreasury);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error BookingAlreadyProcessed(bytes32 bookingId);
    error BookingNotFound(bytes32 bookingId);
    error InvalidAmount();
    error ZeroAddress();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        if (msg.sender != authorizedBackend && msg.sender != authorizedCREWorker && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyBackendOrOwner() {
        if (msg.sender != authorizedBackend && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _travelVault,
        address _rewardPool,
        address _reputation,
        address _companyTreasury,
        address _authorizedBackend
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _companyTreasury == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        travelVault = ITravelVault(_travelVault);
        rewardPool = IRewardPool(_rewardPool);
        reputation = IReputation(_reputation);
        companyTreasury = _companyTreasury;
        authorizedBackend = _authorizedBackend;
    }

    // ─── Core booking functions ───────────────────────────────────────────────

    /**
     * @notice Process a fiat booking (Stripe payment). Backend triggers this
     *         after Stripe webhook confirms payment. Uses treasury USDC.
     */
    function processBookingFiat(
        bytes32 bookingId,
        address user,
        uint256 totalAmount,
        string calldata stripePaymentIntentId
    ) external onlyBackendOrOwner nonReentrant {
        if (processedBookings[bookingId]) revert BookingAlreadyProcessed(bookingId);
        if (totalAmount == 0) revert InvalidAmount();
        if (user == address(0)) revert ZeroAddress();

        _processSplit(bookingId, user, totalAmount, "card", stripePaymentIntentId, false);
    }

    /**
     * @notice Process a direct USDC payment. User transfers USDC directly.
     * @dev User must approve this contract for `totalAmount` USDC first.
     */
    function processBookingUsdc(
        bytes32 bookingId,
        address user,
        uint256 totalAmount
    ) external nonReentrant {
        if (processedBookings[bookingId]) revert BookingAlreadyProcessed(bookingId);
        if (totalAmount == 0) revert InvalidAmount();

        // Pull USDC from user
        usdc.safeTransferFrom(user, address(this), totalAmount);
        _processSplit(bookingId, user, totalAmount, "usdc", "", false);
    }

    /**
     * @notice Process a WLD payment (converted to USDC equivalent by backend).
     *         WLD payments earn 2x reputation points.
     * @dev Backend converts WLD → USDC at oracle price, then calls this.
     */
    function processBookingWld(
        bytes32 bookingId,
        address user,
        uint256 usdcEquivalent,
        string calldata wldTxHash
    ) external onlyBackendOrOwner nonReentrant {
        if (processedBookings[bookingId]) revert BookingAlreadyProcessed(bookingId);
        if (usdcEquivalent == 0) revert InvalidAmount();
        if (user == address(0)) revert ZeroAddress();

        _processSplit(bookingId, user, usdcEquivalent, "wld", wldTxHash, true);
    }

    /**
     * @notice Mark booking as completed (stay finished, verified by CRE oracle).
     *         Triggers Travel Credit release to user.
     */
    function completeBooking(bytes32 bookingId) external onlyAuthorized {
        Booking storage booking = bookings[bookingId];
        if (booking.user == address(0)) revert BookingNotFound(bookingId);
        if (booking.completed) return; // idempotent

        booking.completed = true;
        emit BookingCompleted(bookingId, booking.user);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _processSplit(
        bytes32 bookingId,
        address user,
        uint256 totalAmount,
        string memory paymentMethod,
        string memory stripeOrTxId,
        bool isWld
    ) internal {
        uint256 companyAmount = (totalAmount * COMPANY_BPS) / BPS_DENOMINATOR;
        uint256 travelCreditAmount = (totalAmount * TRAVEL_CREDIT_BPS) / BPS_DENOMINATOR;
        uint256 poolAmount = (totalAmount * POOL_BPS) / BPS_DENOMINATOR;

        // Transfer to company treasury
        usdc.safeTransfer(companyTreasury, companyAmount);

        // Deposit into TravelVault for user
        usdc.approve(address(travelVault), travelCreditAmount);
        travelVault.deposit(user, travelCreditAmount);

        // Contribute to RewardPool
        usdc.approve(address(rewardPool), poolAmount);
        rewardPool.contribute(user, poolAmount);

        // Record reputation
        reputation.recordBooking(user, isWld);

        // Store booking record
        bookings[bookingId] = Booking({
            bookingId: bookingId,
            user: user,
            totalAmount: totalAmount,
            companyAmount: companyAmount,
            travelCreditAmount: travelCreditAmount,
            poolAmount: poolAmount,
            paymentMethod: paymentMethod,
            stripePaymentIntentId: stripeOrTxId,
            completed: false,
            timestamp: block.timestamp
        });

        processedBookings[bookingId] = true;
        bookingCount++;

        emit BookingProcessed(
            bookingId,
            user,
            totalAmount,
            companyAmount,
            travelCreditAmount,
            poolAmount,
            paymentMethod
        );
    }

    // ─── Admin functions ──────────────────────────────────────────────────────

    function setAuthorizedBackend(address _backend) external onlyOwner {
        if (_backend == address(0)) revert ZeroAddress();
        authorizedBackend = _backend;
        emit BackendUpdated(_backend);
    }

    function setAuthorizedCREWorker(address _worker) external onlyOwner {
        authorizedCREWorker = _worker;
        emit CREWorkerUpdated(_worker);
    }

    function setCompanyTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        companyTreasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setTravelVault(address _vault) external onlyOwner {
        travelVault = ITravelVault(_vault);
    }

    function setRewardPool(address _pool) external onlyOwner {
        rewardPool = IRewardPool(_pool);
    }

    function setReputation(address _reputation) external onlyOwner {
        reputation = IReputation(_reputation);
    }

    /**
     * @notice Update WLD/USD price — called by Chainlink CRE price oracle
     * @param newPrice WLD/USD price with 8 decimals (e.g. 2.50 USD = 250_000_000)
     */
    function updateWldPrice(uint256 newPrice) external {
        require(
            msg.sender == owner() || msg.sender == priceOracle,
            "Not authorized"
        );
        require(newPrice > 0, "Invalid price");
        wldUsdPrice = newPrice;
        emit WldPriceUpdated(newPrice, msg.sender);
    }

    /**
     * @notice Set the authorized price oracle address (owner only)
     */
    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
    }

    /**
     * @notice Emergency withdrawal of stuck USDC (only to treasury).
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        usdc.safeTransfer(companyTreasury, amount);
    }
}
