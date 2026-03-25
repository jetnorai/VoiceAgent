// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Reputation
 * @notice Soulbound, non-transferable reputation scores tied to verified
 *         Adelbo identities. Points: bookings +50 (×2 WLD), reviews +30,
 *         referrals +20, monthly streak +10. Four tiers.
 */
contract Reputation is Ownable {

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum Tier { Explorer, Adventurer, Voyager, Globetrotter }

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant BOOKING_POINTS = 50;
    uint256 public constant BOOKING_WLD_MULTIPLIER = 2;
    uint256 public constant REVIEW_POINTS = 30;
    uint256 public constant REFERRAL_POINTS = 20;
    uint256 public constant STREAK_BONUS_POINTS = 10;

    uint256 public constant ADVENTURER_THRESHOLD = 200;
    uint256 public constant VOYAGER_THRESHOLD = 600;
    uint256 public constant GLOBETROTTER_THRESHOLD = 1500;

    // Tier rate discounts in basis points
    uint256[4] public tierDiscounts = [0, 100, 200, 300]; // 0%, 1%, 2%, 3%

    // Pool weight multipliers (1x, 2x, 3x, 5x)
    uint256[4] public poolMultipliers = [1, 2, 3, 5];

    // ─── State ────────────────────────────────────────────────────────────────

    struct UserReputation {
        uint256 totalScore;
        uint256 bookingCount;
        uint256 reviewCount;
        uint256 referralCount;
        uint256 lastActivityMonth; // YYYYMM
        uint256 consecutiveMonths;
        Tier tier;
    }

    struct Review {
        uint256 rating;        // 1-5
        bytes32 contentHash;   // keccak256 of review text
        uint256 timestamp;
        bool verified;
    }

    mapping(address => UserReputation) public reputations;
    mapping(address => Review[]) public reviews;
    mapping(address => bool) public authorizedCallers;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BookingRecorded(address indexed user, uint256 points, bool isWld, Tier newTier);
    event ReviewRecorded(address indexed user, uint256 points, bytes32 contentHash, Tier newTier);
    event ReferralRecorded(address indexed referrer, address indexed referee, uint256 points);
    event TierUpgraded(address indexed user, Tier oldTier, Tier newTier);
    event ReviewVerified(address indexed user, uint256 reviewIndex);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error NonTransferable();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Core functions ───────────────────────────────────────────────────────

    /**
     * @notice Record a booking event. WLD payments earn 2× points.
     */
    function recordBooking(address user, bool isWld) external onlyAuthorized {
        UserReputation storage rep = reputations[user];

        uint256 points = BOOKING_POINTS;
        if (isWld) points *= BOOKING_WLD_MULTIPLIER;

        // Check monthly streak
        uint256 currentMonth = _currentMonth();
        if (rep.lastActivityMonth > 0 && currentMonth == rep.lastActivityMonth + 1) {
            rep.consecutiveMonths++;
            if (rep.consecutiveMonths >= 3) {
                points += STREAK_BONUS_POINTS;
            }
        } else if (currentMonth != rep.lastActivityMonth) {
            rep.consecutiveMonths = 1;
        }

        rep.lastActivityMonth = currentMonth;
        rep.totalScore += points;
        rep.bookingCount++;

        Tier newTier = _computeTier(rep.totalScore);
        if (newTier != rep.tier) {
            emit TierUpgraded(user, rep.tier, newTier);
            rep.tier = newTier;
        }

        emit BookingRecorded(user, points, isWld, rep.tier);
    }

    /**
     * @notice Record a verified review submission.
     */
    function recordReview(
        address user,
        uint256 rating,
        bytes32 contentHash
    ) external onlyAuthorized {
        UserReputation storage rep = reputations[user];

        rep.totalScore += REVIEW_POINTS;
        rep.reviewCount++;

        reviews[user].push(Review({
            rating: rating,
            contentHash: contentHash,
            timestamp: block.timestamp,
            verified: false
        }));

        Tier newTier = _computeTier(rep.totalScore);
        if (newTier != rep.tier) {
            emit TierUpgraded(user, rep.tier, newTier);
            rep.tier = newTier;
        }

        emit ReviewRecorded(user, REVIEW_POINTS, contentHash, rep.tier);
    }

    /**
     * @notice Mark a review as oracle-verified.
     */
    function verifyReview(address user, uint256 reviewIndex) external onlyAuthorized {
        reviews[user][reviewIndex].verified = true;
        emit ReviewVerified(user, reviewIndex);
    }

    /**
     * @notice Record a successful referral.
     */
    function recordReferral(address referrer, address referee) external onlyAuthorized {
        UserReputation storage rep = reputations[referrer];
        rep.totalScore += REFERRAL_POINTS;
        rep.referralCount++;

        Tier newTier = _computeTier(rep.totalScore);
        if (newTier != rep.tier) {
            emit TierUpgraded(referrer, rep.tier, newTier);
            rep.tier = newTier;
        }

        emit ReferralRecorded(referrer, referee, REFERRAL_POINTS);
    }

    // ─── View functions ───────────────────────────────────────────────────────

    function getTier(address user) external view returns (Tier) {
        return reputations[user].tier;
    }

    function getScore(address user) external view returns (uint256) {
        return reputations[user].totalScore;
    }

    /**
     * @notice Loyalty score used by RewardPool for deterministic winner selection.
     *         score = totalContributions × bookingCount × tierMultiplier × streakBonus
     */
    function getLoyaltyScore(address user) external view returns (uint256) {
        UserReputation storage rep = reputations[user];
        if (rep.bookingCount == 0) return 0;

        uint256 tierMult = poolMultipliers[uint256(rep.tier)];
        uint256 streakBonus = rep.consecutiveMonths >= 3 ? 120 : 100; // 1.2× or 1×

        return (rep.totalScore * rep.bookingCount * tierMult * streakBonus) / 100;
    }

    function getRateDiscount(address user) external view returns (uint256) {
        return tierDiscounts[uint256(reputations[user].tier)];
    }

    function getReputation(address user) external view returns (UserReputation memory) {
        return reputations[user];
    }

    function getUserReviews(address user) external view returns (Review[] memory) {
        return reviews[user];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _computeTier(uint256 score) internal pure returns (Tier) {
        if (score >= GLOBETROTTER_THRESHOLD) return Tier.Globetrotter;
        if (score >= VOYAGER_THRESHOLD) return Tier.Voyager;
        if (score >= ADVENTURER_THRESHOLD) return Tier.Adventurer;
        return Tier.Explorer;
    }

    function _currentMonth() internal view returns (uint256) {
        // YYYYMM format
        uint256 timestamp = block.timestamp;
        uint256 year = 1970 + timestamp / 31557600;
        uint256 month = (timestamp % 31557600) / 2629800 + 1;
        return year * 100 + month;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }
}
