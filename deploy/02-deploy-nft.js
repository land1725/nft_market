const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("\n=== 02-部署NFT合约 ===");
  log(`网络: ${network.name} (Chain ID: ${chainId})`);
  log(`部署者: ${deployer}`);

  const args = [deployer]; // NFT合约所有者

  log("\n🎨 部署 NftToken...");
  const nftToken = await deploy("NftToken", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });

  // 在生产网络验证合约
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("\n🔐 验证合约...");
    await verify(nftToken.address, args);
  }

  log("\n✅ NftToken部署完成!");
  log(`地址: ${nftToken.address}`);
  log(`所有者: ${deployer}`);
  log(`名称: NftToken (NTK)`);
};

module.exports.tags = ["all", "nft", "main"];
