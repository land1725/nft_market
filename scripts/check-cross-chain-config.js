const { ethers } = require("hardhat");

async function checkCrossChainConfig() {
    console.log("🔍 检查跨链配置...");
    
    // 使用最新部署的合约地址
    const contracts = {
        ccipAdapter: "0x3155755b79aA083bd953911C92705B7aA82a18F9",
        auction: "0xF8A8B047683062B5BBbbe9D104C9177d6b6cC086"
    };
    
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    const auction = await ethers.getContractAt("Auction", contracts.auction);
    
    console.log("🎯 检查拍卖合约配置...");
    
    // 检查拍卖合约的CCIP适配器设置
    const auctionCcipAdapter = await auction.ccipAdapter();
    console.log(`📍 拍卖合约中的CCIP适配器地址: ${auctionCcipAdapter}`);
    console.log(`📍 实际CCIP适配器地址: ${contracts.ccipAdapter}`);
    console.log(`✅ CCIP适配器匹配: ${auctionCcipAdapter.toLowerCase() === contracts.ccipAdapter.toLowerCase()}`);
    
    console.log("\n🌉 检查CCIP适配器配置...");
    
    // 检查CCIP适配器的拍卖合约设置
    const adapterAuctionContract = await ccipAdapter.auctionContract();
    console.log(`📍 CCIP适配器中的拍卖合约地址: ${adapterAuctionContract}`);
    console.log(`📍 实际拍卖合约地址: ${contracts.auction}`);
    console.log(`✅ 拍卖合约匹配: ${adapterAuctionContract.toLowerCase() === contracts.auction.toLowerCase()}`);
    
    // 检查链选择器配置
    const sepoliaSelector = "16015286601757825753";
    const isSourceAllowed = await ccipAdapter.allowlistedSourceChains(sepoliaSelector);
    const isDestAllowed = await ccipAdapter.allowlistedDestinationChains(sepoliaSelector);
    
    console.log(`\n🔗 链选择器配置 (${sepoliaSelector}):`);
    console.log(`📡 作为源链允许: ${isSourceAllowed}`);
    console.log(`📡 作为目标链允许: ${isDestAllowed}`);
    
    // 检查发送者配置
    const isSenderAllowed = await ccipAdapter.allowlistedSenders(contracts.ccipAdapter);
    console.log(`👤 自身作为发送者允许: ${isSenderAllowed}`);
    
    console.log("\n📊 拍卖基本信息:");
    const auctionStatus = await auction.getAuctionStatus();
    const nftOwner = await auction.nftOwner();
    console.log(`👤 NFT所有者: ${nftOwner}`);
    console.log(`💰 起始价格: ${ethers.formatUnits(auctionStatus._startingPrice, 6)} USD`);
    console.log(`📈 竞拍增量: ${ethers.formatUnits(auctionStatus._bidIncrement, 6)} USD`);
    console.log(`⏰ 开始时间: ${new Date(Number(auctionStatus._startTime) * 1000)}`);
    console.log(`⏰ 结束时间: ${new Date(Number(auctionStatus._endTime) * 1000)}`);
    
    // 检查当前时间
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = Number(auctionStatus._startTime);
    const endTime = Number(auctionStatus._endTime);
    console.log(`⏰ 当前时间: ${new Date()}`);
    console.log(`⏰ 拍卖状态: ${currentTime < startTime ? '未开始' : currentTime < endTime ? '进行中' : '已结束'}`);
}

async function main() {
    try {
        await checkCrossChainConfig();
    } catch (error) {
        console.error("❌ 检查失败:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
