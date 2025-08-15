const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("\n=== 00-部署基础Mock合约 ===");
  log(`网络: ${network.name} (Chain ID: ${chainId})`);
  log(`部署者: ${deployer}`);

  // 在开发网络中部署Mock合约
  if (developmentChains.includes(network.name)) {
    log("\n📦 部署 MockLINK...");
    const mockLINK = await deploy("MockLINK", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: 1,
    });

    log("\n🔮 部署 MockPriceOracle...");
    const mockPriceOracle = await deploy("MockPriceOracle", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: 1,
    });

    log("\n✅ Mock合约部署完成!");
    log(`MockLINK: ${mockLINK.address}`);
    log(`MockPriceOracle: ${mockPriceOracle.address}`);
    log(`固定价格: 1 ETH = 2000 USD, 1 LINK = 15 USD`);
  } else {
    log("\n⏭️  生产网络，跳过Mock合约部署");
  }
};

module.exports.tags = ["all", "mocks", "main"];
