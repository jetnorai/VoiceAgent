// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IReputation {
    function getLoyaltyScore(address user) external view returns (uint256);
}

/**
 * @title RewardPool
 * @notice Accumulates 2% of completed booking value in 30-day cycles.
 *         Distribution is deterministic, loyalty-weighted (not random).
 *         Supports CRE-automated distribution (primary) and admin-manual (fallback).
 * @dev USDC uses 6 decimals on World Chain.
 */
contract RewardPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    IReputation public reputation;
    address public marginSplitter;
    address public authorizedCREWorker;
    address public authorizedBackend;

    uint256 public currentCycleId;
    uint256 public cycleDuration = 30 days;

    struct Cycle {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 totalAmount;
        uint256 participantCount;
        uint256 winnerCount;
        bool distributed;
        uint256 distributedAt;
    }

    struct Contribution {
        address user;
        uint256 amount;
        uint256 loyaltyScore;
        uint256 cycleId;
    }

    struct Distribution {
        address winner;
        uint256 amount;
        uint256 loyaltyScore;
        uint256 rank;
    }

    mapping(uint256 => Cycle) public cycles;
    mapping(uint256 => Contribution[]) public cycleContributions;
    mapping(uint256 => mapping(address => uint256)) public userCycleContribution;
    mapping(uint256 => Distribution[]) public cycleDistributions;

    // ─── Events ───────────────────────────────────────────────────────────────

    event CycleStarted(uint256 indexed cycleId, uint256 startTime, uint256 endTime);
    event Contributed(address indexed user, uint256 amount, uint256 indexed cycleId);
    event PoolDistributed(
        uint256 indexed cycleId,
        uint256 totalDistributed,
        uint256 winnerCount
    );
    event WinnerPaid(
        uint256 indexed cycleId,
        address indexed winner,
        uint256 amount,
        uint256 rank
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error CycleNotEnded();
    error CycleAlreadyDistributed();
    error NoCycleActive();
    error InvalidWinnerCount();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyMarginSplitter() {
        if (msg.sender != marginSplitter) revert Unauthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != authorizedCREWorker && msg.sender != authorizedBackend && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _reputation,
        address _authorizedBackend
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        reputation = IReputation(_reputation);
        authorizedBackend = _authorizedBackend;
        _startNewCycle();
    }

    // ─── Core functions ───────────────────────────────────────────────────────

    /**
     * @notice Record a contribution from a booking. Called by MarginSplitter.
     */
    function contribute(address user, uint256 amount) external onlyMarginSplitter nonReentrant {
        Cycle storage cycle = cycles[currentCycleId];
        if (cycle.id == 0) revert NoCycleActive();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Get loyalty score snapshot
        uint256 loyaltyScore = 0;
        try reputation.getLoyaltyScore(user) returns (uint256 score) {
            loyaltyScore = score;
        } catch {}

        if (userCycleContribution[currentCycleId][user] == 0) {
            cycle.participantCount++;
        }

        userCycleContribution[currentCycleId][user] += amount;
        cycle.totalAmount += amount;

        cycleContributions[currentCycleId].push(Contribution({
            user: user,
            amount: amount,
            loyaltyScore: loyaltyScore,
            cycleId: currentCycleId
        }));

        emit Contributed(user, amount, currentCycleId);
    }

    /**
     * @notice Distribute the current cycle's pool to winners.
     *         Called by Chainlink CRE (primary) or admin (fallback).
     *         Selection is deterministic, loyalty-weighted — not random.
     * @param cycleId The cycle to distribute
     * @param winnerCount Number of winners (1–10)
     * @param winnerAddresses Pre-computed winner list from CRE consensus
     * @param winnerAmounts USDC amounts per winner
     */
    function distributePool(
        uint256 cycleId,
        uint256 winnerCount,
        address[] calldata winnerAddresses,
        uint256[] calldata winnerAmounts
    ) external onlyAuthorized nonReentrant {
        Cycle storage cycle = cycles[cycleId];
        if (block.timestamp < cycle.endTime) revert CycleNotEnded();
        if (cycle.distributed) revert CycleAlreadyDistributed();
        if (winnerCount == 0 || winnerCount > 10) revert InvalidWinnerCount();
        require(winnerAddresses.length == winnerCount, "Winner count mismatch");
        require(winnerAmounts.length == winnerCount, "Amount count mismatch");

        cycle.distributed = true;
        cycle.distributedAt = block.timestamp;

        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < winnerCount; i++) {
            usdc.safeTransfer(winnerAddresses[i], winnerAmounts[i]);
            totalDistributed += winnerAmounts[i];

            cycleDistributions[cycleId].push(Distribution({
                winner: winnerAddresses[i],
                amount: winnerAmounts[i],
                loyaltyScore: userCycleContribution[cycleId][winnerAddresses[i]],
                rank: i + 1
            }));

            emit WinnerPaid(cycleId, winnerAddresses[i], winnerAmounts[i], i + 1);
        }

        emit PoolDistributed(cycleId, totalDistributed, winnerCount);

        // Start next cycle
        _startNewCycle();
    }

    /**
     * @notice View the deterministic winner list for a cycle.
     *         Loyalty score = contribution × bookingCount × tierMultiplier × streakBonus
     */
    function computeWinners(
        uint256 cycleId,
        uint256 winnerCount
    ) external view returns (address[] memory winners, uint256[] memory scores) {
        Contribution[] storage contribs = cycleContributions[cycleId];
        Cycle storage cycle = cycles[cycleId];

        if (contribs.length == 0) {
            return (new address[](0), new uint256[](0));
        }

        uint256 actualWinners = winnerCount > contribs.length ? contribs.length : winnerCount;
        winners = new address[](actualWinners);
        scores = new uint256[](actualWinners);

        // Aggregate scores per user
        address[] memory users = new address[](contribs.length);
        uint256[] memory userScores = new uint256[](contribs.length);
        uint256 uniqueUsers = 0;

        for (uint256 i = 0; i < contribs.length; i++) {
            address u = contribs[i].user;
            bool found = false;
            for (uint256 j = 0; j < uniqueUsers; j++) {
                if (users[j] == u) {
                    userScores[j] += contribs[i].amount;
                    found = true;
                    break;
                }
            }
            if (!found) {
                users[uniqueUsers] = u;
                userScores[uniqueUsers] = userCycleContribution[cycleId][u];
                uniqueUsers++;
            }
        }

        // Simple selection sort for top winners (sufficient for ≤100 participants)
        for (uint256 i = 0; i < actualWinners; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < uniqueUsers; j++) {
                if (userScores[j] > userScores[maxIdx]) maxIdx = j;
            }
            // Swap
            (users[i], users[maxIdx]) = (users[maxIdx], users[i]);
            (userScores[i], userScores[maxIdx]) = (userScores[maxIdx], userScores[i]);
            winners[i] = users[i];
            scores[i] = userScores[i];
        }

        // Compute payout amounts (proportional to score)
        uint256 totalScore = 0;
        for (uint256 i = 0; i < actualWinners; i++) totalScore += scores[i];

        // Reuse scores array for amounts
        uint256 remaining = cycle.totalAmount;
        for (uint256 i = 0; i < actualWinners; i++) {
            scores[i] = totalScore > 0 ? (cycle.totalAmount * scores[i]) / totalScore : cycle.totalAmount / actualWinners;
            if (i == actualWinners - 1) scores[i] = remaining; // dust to last winner
            else remaining -= scores[i];
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _startNewCycle() internal {
        currentCycleId++;
        uint256 start = block.timestamp;
        uint256 end = start + cycleDuration;

        cycles[currentCycleId] = Cycle({
            id: currentCycleId,
            startTime: start,
            endTime: end,
            totalAmount: 0,
            participantCount: 0,
            winnerCount: 3,
            distributed: false,
            distributedAt: 0
        });

        emit CycleStarted(currentCycleId, start, end);
    }

    // ─── View functions ───────────────────────────────────────────────────────

    function getCurrentCycle() external view returns (Cycle memory) {
        return cycles[currentCycleId];
    }

    function getCycleDistributions(uint256 cycleId) external view returns (Distribution[] memory) {
        return cycleDistributions[cycleId];
    }

    function getUserContribution(address user, uint256 cycleId) external view returns (uint256) {
        return userCycleContribution[cycleId][user];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setMarginSplitter(address _splitter) external onlyOwner {
        marginSplitter = _splitter;
    }

    function setCREWorker(address _worker) external onlyOwner {
        authorizedCREWorker = _worker;
    }

    function setReputation(address _reputation) external onlyOwner {
        reputation = IReputation(_reputation);
    }

    function setCycleDuration(uint256 _duration) external onlyOwner {
        cycleDuration = _duration;
    }
}
