import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('TravelVault', function () {
  async function deployFixture() {
    const [owner, depositor, user1] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const usdc = await MockERC20.deploy('USD Coin', 'USDC', 6);

    const TravelVault = await ethers.getContractFactory('TravelVault');
    const vault = await TravelVault.deploy(await usdc.getAddress(), owner.address);

    await vault.grantRole(await vault.DEPOSITOR_ROLE(), depositor.address);

    const depositAmount = ethers.parseUnits('10', 6);
    await usdc.mint(depositor.address, depositAmount);
    await usdc.connect(depositor).approve(await vault.getAddress(), depositAmount);

    return { vault, usdc, owner, depositor, user1, depositAmount };
  }

  it('should deposit travel credit for user', async function () {
    const { vault, usdc, depositor, user1, depositAmount } = await loadFixture(deployFixture);

    await vault.connect(depositor).deposit(user1.address, depositAmount);

    const balance = await vault.getBalance(user1.address);
    expect(balance).to.equal(depositAmount);
  });

  it('should allow user to withdraw their credit', async function () {
    const { vault, usdc, depositor, user1, depositAmount } = await loadFixture(deployFixture);

    await vault.connect(depositor).deposit(user1.address, depositAmount);
    await vault.connect(user1).withdraw(depositAmount);

    const balance = await vault.getBalance(user1.address);
    expect(balance).to.equal(0n);

    const userBalance = await usdc.balanceOf(user1.address);
    expect(userBalance).to.equal(depositAmount);
  });

  it('should revert withdrawal exceeding balance', async function () {
    const { vault, usdc, depositor, user1, depositAmount } = await loadFixture(deployFixture);

    await vault.connect(depositor).deposit(user1.address, depositAmount);

    await expect(
      vault.connect(user1).withdraw(depositAmount + 1n)
    ).to.be.revertedWith('Insufficient balance');
  });

  it('should revert deposit from non-depositor', async function () {
    const { vault, user1, depositAmount } = await loadFixture(deployFixture);

    await expect(
      vault.connect(user1).deposit(user1.address, depositAmount)
    ).to.be.reverted;
  });
});
