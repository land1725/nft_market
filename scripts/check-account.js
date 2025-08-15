const { ethers } = require("hardhat");

async function main() {
  const accounts = await ethers.getSigners();
  const mainAccount = accounts[0];
  
  console.log("📋 主账户信息:");
  console.log(`地址: ${mainAccount.address}`);
  
  const balance = await ethers.provider.getBalance(mainAccount.address);
  console.log(`余额: ${ethers.formatEther(balance)} ETH`);
  
  // 显示网络信息
  const network = await ethers.provider.getNetwork();
  console.log(`网络: ${network.name} (Chain ID: ${network.chainId})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
