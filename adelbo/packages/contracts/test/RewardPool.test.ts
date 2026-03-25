import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('RewardPool', function () {
  async function deployFixture() {
    const [owner, contributor, user1, user2, user3] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const usdc = await MockERC20.deploy('USD Coin', 'USDC', 6);

    const RewardPool = await ethers.getContractFactory('RewardPool');
    const pool = await RewardPool.deploy(await usdc.getAddress(), owner.address);

    await pool.grantRole(await pool.CONTRIBUTOR_ROLE(), contributor.address);

    const total = ethers.parseUnits('1000', 6);
    await usdc.mint(contributor.address, total);
    await usdc.connect(contributor).approve(await pool.getAddress(), total);

    return { pool, usdc, owner, contributor, user1, user2, user3, total };
  }

  it('should accept contributions', async function () {
    const { pool, usdc, contributor, user1 } = await loadFixture(deployFixture);

    const amount = ethers.parseUnits('20', 6);
    await pool.connect(contributor).contribute(user1.address, amount, 1n);

    const balance = await usdc.balanceOf(await pool.getAddress());
    expect(balance).to.equal(amount);
  });

  it('should distribute pool to contributors proportionally', async function () {
    const { pool, usdc, contributor, user1, user2 } = await loadFixture(deployFixture);

    const amt1 = ethers.parseUnits('40', 6);
    const amt2 = ethers.parseUnits('60', 6);

    await pool.connect(contributor).contribute(user1.address, amt1, 1n);
    await pool.connect(contributor).contribute(user2.address, amt2, 1n);

    // Fast-forward 30 days
    await time.increase(30 * 24 * 60 * 60);

    const u1Before = await usdc.balanceOf(user1.address);
    const u2Before = await usdc.balanceOf(user2.address);

    await pool.distributePool([user1.address, user2.address], [1n, 1n]);

    const u1After = await usdc.balanceOf(user1.address);
    const u2After = await usdc.balanceOf(user2.address);

    // user1 had 40% of contributions, user2 had 60%
    const totalPool = amt1 + amt2;
    const u1Expected = (totalPool * 40n) / 100n;
    const u2Expected = (totalPool * 60n) / 100n;

    expect(u1After - u1Before).to.be.closeTo(u1Expected, ethers.parseUnits('0.01', 6));
    expect(u2After - u2Before).to.be.closeTo(u2Expected, ethers.parseUnits('0.01', 6));
  });
});
