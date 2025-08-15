const { network } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("----------------------------------------------------");
    console.log("Deploying CCIP Adapter...");
    console.log("Network:", network.name);

    // 获取已部署的Mock合约地址
    const mockLinkToken = await get("MockLinkToken");
    console.log(`🔗 Mock LINK Token: ${mockLinkToken.address}`);

    // 首先部署Mock CCIP Router
    console.log("🚀 Deploying Mock CCIP Router...");
    const mockRouter = await deploy("MockCCIPRouter", {
        from: deployer,
        args: [mockLinkToken.address],
        log: true,
        waitConfirmations: 1,
    });
    console.log(`✅ Mock CCIP Router deployed at: ${mockRouter.address}`);

    // 部署 CCIP Adapter
    console.log("🌉 Deploying CCIP Adapter...");
    const ccipAdapter = await deploy("CcipAdapter", {
        from: deployer,
        args: [
            mockRouter.address,      // Mock CCIP Router address
            mockLinkToken.address    // Mock LINK Token address
        ],
        log: true,
        waitConfirmations: 1,
    });

    console.log(`✅ CcipAdapter deployed at: ${ccipAdapter.address}`);

    // 设置链选择器
    // 配置 CCIP Adapter
    console.log("🔧 Configuring CCIP Adapter...");
    const { ethers } = require("hardhat");
    const ccipAdapterContract = await ethers.getContractAt("CcipAdapter", ccipAdapter.address);
    
    // 模拟链选择器
    const ethereumSelector = "5009297550715157269";   // Ethereum Mainnet (模拟)
    const polygonSelector = "4051577828743386545";    // Polygon Mainnet (模拟)
    
    // 允许以太坊和Polygon作为源链和目标链
    await ccipAdapterContract.allowlistSourceChain(ethereumSelector, true);
    await ccipAdapterContract.allowlistDestinationChain(ethereumSelector, true);
    await ccipAdapterContract.allowlistSourceChain(polygonSelector, true);
    await ccipAdapterContract.allowlistDestinationChain(polygonSelector, true);
    
    console.log(`✅ Allowed Ethereum as source/destination chain: ${ethereumSelector}`);
    console.log(`✅ Allowed Polygon as source/destination chain: ${polygonSelector}`);
    
    // 允许自己作为发送者
    await ccipAdapterContract.allowlistSender(ccipAdapter.address, true);
    console.log(`✅ Allowed self as sender: ${ccipAdapter.address}`);

    console.log("----------------------------------------------------");
};

module.exports.tags = ["CcipAdapter", "ccip"];
module.exports.dependencies = ["MockLinkToken"];
