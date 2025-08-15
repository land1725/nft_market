const { ethers } = require("hardhat");

/**
 * @dev 跨链竞拍脚本
 * 用法: npx hardhat run scripts/cross-chain-bid.js --network polygonAmoy
 */
async function main() {
    console.log("🌉 开始跨链竞拍测试...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`📝 账户: ${deployer.address}`);
    
    // 检查网络
    const network = await ethers.provider.getNetwork();
    console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.name !== "polygonAmoy") {
        console.log("❌ 此脚本应在Polygon Amoy网络上运行");
        return;
    }

    // CCIP适配器地址 (需要先部署)
    const CCIP_ADAPTER_ADDRESS = "0x..."; // 部署后填入实际地址
    const SEPOLIA_CCIP_ADAPTER = "0x..."; // Sepolia上的CCIP适配器地址
    
    // 链选择器
    const SEPOLIA_CHAIN_SELECTOR = "16015286601757825753";
    
    try {
        // 获取CCIP适配器合约
        const ccipAdapter = await ethers.getContractAt("CcipAdapter", CCIP_ADAPTER_ADDRESS);
        
        // 竞拍参数
        const bidder = deployer.address;
        const bidAmount = ethers.parseUnits("100", 6); // 100 USD (假设6位精度)
        
        console.log(`💰 竞拍者: ${bidder}`);
        console.log(`💵 竞拍金额: ${ethers.formatUnits(bidAmount, 6)} USD`);
        
        // 发送跨链竞拍
        console.log("🚀 发送跨链竞拍消息...");
        const tx = await ccipAdapter.sendCrossChainBid(
            SEPOLIA_CHAIN_SELECTOR,
            SEPOLIA_CCIP_ADAPTER,
            bidder,
            bidAmount
        );
        
        console.log(`📝 交易哈希: ${tx.hash}`);
        
        // 等待交易确认
        const receipt = await tx.wait();
        console.log(`✅ 交易确认，Gas使用: ${receipt.gasUsed}`);
        
        // 查找MessageSent事件
        const messageSentEvent = receipt.logs.find(
            log => log.fragment && log.fragment.name === "MessageSent"
        );
        
        if (messageSentEvent) {
            const messageId = messageSentEvent.args.messageId;
            console.log(`📨 CCIP消息ID: ${messageId}`);
            console.log(`🎯 目标链: Sepolia (${SEPOLIA_CHAIN_SELECTOR})`);
            console.log(`📍 接收合约: ${SEPOLIA_CCIP_ADAPTER}`);
        }
        
        console.log("✅ 跨链竞拍消息发送成功！");
        console.log("⏳ 等待CCIP网络处理消息...");
        console.log("🔍 可在Sepolia网络上检查竞拍是否成功");
        
    } catch (error) {
        console.error("❌ 跨链竞拍失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
