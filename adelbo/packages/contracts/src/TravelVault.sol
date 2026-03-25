// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TravelVault
 * @notice Per-user Travel Credit accounts. Funded by 1.25% of each completed
 *         booking via MarginSplitter. Users can withdraw or apply balance
 *         toward future bookings.
 * @dev USDC uses 6 decimals on World Chain.
 */
contract TravelVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public marginSplitter;
    address public authorizedBackend;

    struct UserVault {
        uint256 balance;          // current spendable balance (USDC, 6 dec)
        uint256 lifetimeDeposited;
        uint256 lifetimeWithdrawn;
        uint256 lifetimeUsed;     // applied to bookings
        uint256 lastDepositAt;
    }

    mapping(address => UserVault) public vaults;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event Applied(address indexed user, uint256 amount, bytes32 bookingId, uint256 newBalance);
    event MarginSplitterUpdated(address indexed newSplitter);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error InsufficientBalance(uint256 available, uint256 requested);
    error InvalidAmount();
    error ZeroAddress();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyMarginSplitter() {
        if (msg.sender != marginSplitter) revert Unauthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != authorizedBackend && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc, address _authorizedBackend) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        authorizedBackend = _authorizedBackend;
    }

    // ─── Core functions ───────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into a user's vault. Called by MarginSplitter.
     * @dev Note: pending until booking completes. Balance is held but
     *      not accessible until completion event.
     */
    function deposit(address user, uint256 amount) external onlyMarginSplitter nonReentrant {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        UserVault storage vault = vaults[user];
        vault.balance += amount;
        vault.lifetimeDeposited += amount;
        vault.lastDepositAt = block.timestamp;

        emit Deposited(user, amount, vault.balance);
    }

    /**
     * @notice User withdraws Travel Credit to their wallet.
     */
    function withdraw(uint256 amount) external nonReentrant {
        UserVault storage vault = vaults[msg.sender];
        if (amount == 0) revert InvalidAmount();
        if (vault.balance < amount) revert InsufficientBalance(vault.balance, amount);

        vault.balance -= amount;
        vault.lifetimeWithdrawn += amount;

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, vault.balance);
    }

    /**
     * @notice Backend applies Travel Credit to a booking (reduces payment amount).
     *         Called when user selects "Apply credit" at checkout.
     */
    function applyToBooking(
        address user,
        uint256 amount,
        bytes32 bookingId
    ) external onlyAuthorized nonReentrant {
        if (amount == 0) revert InvalidAmount();

        UserVault storage vault = vaults[user];
        if (vault.balance < amount) revert InsufficientBalance(vault.balance, amount);

        vault.balance -= amount;
        vault.lifetimeUsed += amount;

        // Return USDC to backend treasury (to offset booking cost)
        usdc.safeTransfer(authorizedBackend, amount);

        emit Applied(user, amount, bookingId, vault.balance);
    }

    // ─── View functions ───────────────────────────────────────────────────────

    function balanceOf(address user) external view returns (uint256) {
        return vaults[user].balance;
    }

    function getVault(address user) external view returns (UserVault memory) {
        return vaults[user];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setMarginSplitter(address _splitter) external onlyOwner {
        if (_splitter == address(0)) revert ZeroAddress();
        marginSplitter = _splitter;
        emit MarginSplitterUpdated(_splitter);
    }

    function setAuthorizedBackend(address _backend) external onlyOwner {
        authorizedBackend = _backend;
    }
}
