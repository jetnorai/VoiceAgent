import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Adelbo contracts with:', deployer.address);

  const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';
  const COMPANY_TREASURY = process.env.COMPANY_TREASURY || deployer.address;
  const BACKEND_ADDRESS = process.env.BACKEND_ADDRESS || deployer.address;

  // 1. Deploy Reputation
  const Reputation = await ethers.getContractFactory('Reputation');
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  console.log('Reputation deployed:', await reputation.getAddress());

  // 2. Deploy TravelVault
  const TravelVault = await ethers.getContractFactory('TravelVault');
  const travelVault = await TravelVault.deploy(USDC_ADDRESS, BACKEND_ADDRESS);
  await travelVault.waitForDeployment();
  console.log('TravelVault deployed:', await travelVault.getAddress());

  // 3. Deploy RewardPool
  const RewardPool = await ethers.getContractFactory('RewardPool');
  const rewardPool = await RewardPool.deploy(
    USDC_ADDRESS,
    await reputation.getAddress(),
    BACKEND_ADDRESS
  );
  await rewardPool.waitForDeployment();
  console.log('RewardPool deployed:', await rewardPool.getAddress());

  // 4. Deploy MarginSplitter
  const MarginSplitter = await ethers.getContractFactory('MarginSplitter');
  const marginSplitter = await MarginSplitter.deploy(
    USDC_ADDRESS,
    await travelVault.getAddress(),
    await rewardPool.getAddress(),
    await reputation.getAddress(),
    COMPANY_TREASURY,
    BACKEND_ADDRESS
  );
  await marginSplitter.waitForDeployment();
  console.log('MarginSplitter deployed:', await marginSplitter.getAddress());

  // 5. Wire up permissions
  await travelVault.setMarginSplitter(await marginSplitter.getAddress());
  await rewardPool.setMarginSplitter(await marginSplitter.getAddress());
  await reputation.setAuthorizedCaller(await marginSplitter.getAddress(), true);
  await reputation.setAuthorizedCaller(BACKEND_ADDRESS, true);

  console.log('\n✅ All contracts deployed and wired up.');
  console.log('\n.env values:');
  console.log(`MARGIN_SPLITTER_ADDRESS=${await marginSplitter.getAddress()}`);
  console.log(`TRAVEL_VAULT_ADDRESS=${await travelVault.getAddress()}`);
  console.log(`REWARD_POOL_ADDRESS=${await rewardPool.getAddress()}`);
  console.log(`REPUTATION_ADDRESS=${await reputation.getAddress()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
