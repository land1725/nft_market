const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("\n=== 03-部署拍卖工厂 (UUPS代理) ===");
  log(`网络: ${network.name} (Chain ID: ${chainId})`);
  log(`部署者: ${deployer}`);

  const args = []; // 初始化参数

  log("\n🏭 部署 AuctionFactory...");
  const auctionFactory = await deploy("AuctionFactory", {
    from: deployer,
    args: args,
    log: true,
    proxy: {
      proxyContract: "UUPS",
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });

  // 在生产网络验证合约
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("\n🔐 验证合约...");
    await verify(auctionFactory.address, args);
  }

  log("\n✅ AuctionFactory部署完成!");
  log(`代理地址: ${auctionFactory.address}`);
  log(`所有者: ${deployer}`);
  log(`代理模式: UUPS (可升级)`);
};

module.exports.tags = ["all", "factory", "main"];
