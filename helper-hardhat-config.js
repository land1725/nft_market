const networkConfig = {
  31337: {
    name: "localhost",
    ethUsdPriceFeed: "0x0000000000000000000000000000000000000000", // Mock地址
    ccipRouter: null, // 本地网络不支持CCIP
  },
  11155111: {
    name: "sepolia",
    ethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Sepolia ETH/USD
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // Sepolia CCIP Router
  },
  1: {
    name: "mainnet",
    ethUsdPriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Mainnet ETH/USD
    ccipRouter: "0x80226fc0ee2b096224eeac085bb9a8cba1146f7d", // Mainnet CCIP Router
  },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChains,
};
