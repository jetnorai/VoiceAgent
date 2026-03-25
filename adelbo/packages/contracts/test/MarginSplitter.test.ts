import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('MarginSplitter', function () {
  async function deployFixture() {
    const [owner, company, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC (6 decimals)
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const usdc = await MockERC20.deploy('USD Coin', 'USDC', 6);

    // Deploy TravelVault
    const TravelVault = await ethers.getContractFactory('TravelVault');
    const vault = await TravelVault.deploy(await usdc.getAddress(), owner.address);

    // Deploy RewardPool
    const RewardPool = await ethers.getContractFactory('RewardPool');
    const pool = await RewardPool.deploy(await usdc.getAddress(), owner.address);

    // Deploy Reputation
    const Reputation = await ethers.getContractFactory('Reputation');
    const reputation = await Reputation.deploy(owner.address);

    // Deploy MarginSplitter
    const MarginSplitter = await ethers.getContractFactory('MarginSplitter');
    const splitter = await MarginSplitter.deploy(
      await usdc.getAddress(),
      ethers.ZeroAddress, // WLD token (mock as zero for tests)
      company.address,
      await vault.getAddress(),
      await pool.getAddress(),
      await reputation.getAddress(),
      owner.address
    );

    // Grant roles
    await vault.grantRole(await vault.DEPOSITOR_ROLE(), await splitter.getAddress());
    await pool.grantRole(await pool.CONTRIBUTOR_ROLE(), await splitter.getAddress());
    await reputation.grantRole(await reputation.RECORDER_ROLE(), await splitter.getAddress());

    // Mint USDC to user1
    const amount = ethers.parseUnits('100', 6); // 100 USDC
    await usdc.mint(user1.address, amount);
    await usdc.connect(user1).approve(await splitter.getAddress(), amount);

    return { splitter, vault, pool, reputation, usdc, owner, company, user1, user2, amount };
  }

  describe('processBookingUsdc', function () {
    it('should split booking correctly', async function () {
      const { splitter, vault, pool, usdc, company, user1, amount } = await loadFixture(deployFixture);

      const bookingId = ethers.keccak256(ethers.toUtf8Bytes('booking-001'));
      const companyBefore = await usdc.balanceOf(company.address);

      await splitter.connect(user1).processBookingUsdc(bookingId, amount, user1.address);

      // Company gets 1.75%
      const companyAfter = await usdc.balanceOf(company.address);
      const companyShare = (amount * 175n) / 10000n;
      expect(companyAfter - companyBefore).to.equal(companyShare);

      // Vault gets 1.25%
      const creditShare = (amount * 125n) / 10000n;
      const vaultBalance = await usdc.balanceOf(await vault.getAddress());
      expect(vaultBalance).to.equal(creditShare);

      // Pool gets 2%
      const poolShare = (amount * 200n) / 10000n;
      const poolBalance = await usdc.balanceOf(await pool.getAddress());
      expect(poolBalance).to.equal(poolShare);
    });

    it('should emit BookingProcessed event', async function () {
      const { splitter, usdc, user1, amount } = await loadFixture(deployFixture);
      const bookingId = ethers.keccak256(ethers.toUtf8Bytes('booking-002'));

      await expect(splitter.connect(user1).processBookingUsdc(bookingId, amount, user1.address))
        .to.emit(splitter, 'BookingProcessed')
        .withArgs(bookingId, user1.address, amount, 'USDC');
    });

    it('should revert on duplicate booking', async function () {
      const { splitter, usdc, user1, amount } = await loadFixture(deployFixture);
      const bookingId = ethers.keccak256(ethers.toUtf8Bytes('booking-003'));

      await splitter.connect(user1).processBookingUsdc(bookingId, amount, user1.address);

      // Mint more USDC for second attempt
      await usdc.mint(user1.address, amount);
      await usdc.connect(user1).approve(await splitter.getAddress(), amount);

      await expect(
        splitter.connect(user1).processBookingUsdc(bookingId, amount, user1.address)
      ).to.be.revertedWith('Already processed');
    });
  });

  describe('completeBooking', function () {
    it('should complete booking and update reputation', async function () {
      const { splitter, reputation, usdc, user1, amount } = await loadFixture(deployFixture);
      const bookingId = ethers.keccak256(ethers.toUtf8Bytes('booking-004'));

      await splitter.connect(user1).processBookingUsdc(bookingId, amount, user1.address);

      // Only owner/operator can complete
      await splitter.completeBooking(bookingId, user1.address);

      const score = await reputation.getScore(user1.address);
      expect(score).to.be.gt(0n);
    });
  });
});
