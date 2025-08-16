const { network } = require("hardhat");
const { networkConfig, developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("\n=== 01-部署价格预言机 ===");
  log(`网络: ${network.name} (Chain ID: ${chainId})`);
  log(`部署者: ${deployer}`);

  // PriceOracle 合约已经硬编码了Sepolia的价格预言机地址
  // 所以构造函数不需要参数
  const args = [];

  log("\n📦 部署 PriceOracle...");
  const priceOracle = await deploy("PriceOracle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });

  // 在生产网络验证合约
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("\n🔐 验证合约...");
    await verify(priceOracle.address, args);
  }

  log("\n✅ PriceOracle部署完成!");
  log(`地址: ${priceOracle.address}`);
  log(`注意: 价格预言机地址已硬编码在合约中`);
};

module.exports.tags = ["all", "oracle", "main"];
