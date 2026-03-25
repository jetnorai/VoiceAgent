import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('Reputation', function () {
  async function deployFixture() {
    const [owner, recorder, user1] = await ethers.getSigners();

    const Reputation = await ethers.getContractFactory('Reputation');
    const reputation = await Reputation.deploy(owner.address);

    await reputation.grantRole(await reputation.RECORDER_ROLE(), recorder.address);

    return { reputation, owner, recorder, user1 };
  }

  it('should record booking and increase score', async function () {
    const { reputation, recorder, user1 } = await loadFixture(deployFixture);

    await reputation.connect(recorder).recordBooking(user1.address, false); // USDC booking
    const score = await reputation.getScore(user1.address);
    expect(score).to.be.gt(0n);
  });

  it('should give 2x points for WLD booking', async function () {
    const { reputation, recorder, user1 } = await loadFixture(deployFixture);

    const [user2] = await ethers.getSigners();

    await reputation.connect(recorder).recordBooking(user1.address, false); // USDC
    await reputation.connect(recorder).recordBooking(user2.address, true);  // WLD

    const score1 = await reputation.getScore(user1.address);
    const score2 = await reputation.getScore(user2.address);

    expect(score2).to.equal(score1 * 2n);
  });

  it('should progress through tiers', async function () {
    const { reputation, recorder, user1 } = await loadFixture(deployFixture);

    const getTier = async () => reputation.getTier(user1.address);

    expect(await getTier()).to.equal('bronze');

    // Bronze → Silver needs 200 points; 10 pts per booking → 20 WLD bookings
    for (let i = 0; i < 20; i++) {
      await reputation.connect(recorder).recordBooking(user1.address, true);
    }
    expect(await getTier()).to.equal('silver');
  });

  it('should be non-transferable (soulbound)', async function () {
    const { reputation, recorder, user1 } = await loadFixture(deployFixture);

    await reputation.connect(recorder).recordBooking(user1.address, false);

    // Attempt transfer should revert — reputation tokens are soulbound
    const tokenId = await reputation.tokenOf(user1.address);
    await expect(
      reputation.connect(user1).transferFrom(user1.address, recorder.address, tokenId)
    ).to.be.reverted;
  });
});
