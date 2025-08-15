const { ethers } = require("hardhat");

/**
 * @dev 检查跨链竞拍状态脚本
 * 用法: npx hardhat run scripts/check-cross-chain-status.js --network sepolia
 */
async function main() {
    console.log("🔍 检查跨链竞拍状态...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`📝 账户: ${deployer.address}`);
    
    // 检查网络
    const network = await ethers.provider.getNetwork();
    console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
    
    // 合约地址 (需要根据实际部署填入)
    const AUCTION_ADDRESS = "0x..."; // 拍卖合约地址
    const CCIP_ADAPTER_ADDRESS = "0x..."; // CCIP适配器地址
    
    try {
        // 获取拍卖合约
        const auction = await ethers.getContractAt("Auction", AUCTION_ADDRESS);
        
        console.log("\n📊 拍卖状态:");
        console.log("=" .repeat(50));
        
        // 基本拍卖信息
        const auctionStatus = await auction.getAuctionStatus();
        console.log(`⏰ 开始时间: ${new Date(Number(auctionStatus._startTime) * 1000).toLocaleString()}`);
        console.log(`⏰ 过期时间: ${auctionStatus._expirationTime} 秒`);
        console.log(`💰 起拍价: ${auctionStatus._startingPrice} USD`);
        console.log(`📈 加价幅度: ${auctionStatus._bidIncrement} USD`);
        
        // 当前最高出价
        console.log(`\n🏆 当前最高出价:`);
        console.log(`💵 金额: ${auctionStatus._highestUSD} USD`);
        console.log(`👤 出价者: ${auctionStatus._highestBidder}`);
        
        // 跨链获胜者信息
        const [isWinnerCrossChain, winningMessageId] = await auction.getCrossChainWinnerInfo();
        console.log(`\n🌉 跨链状态:`);
        console.log(`🔗 是否跨链获胜者: ${isWinnerCrossChain}`);
        
        if (isWinnerCrossChain && winningMessageId !== ethers.ZeroHash) {
            console.log(`📨 获胜消息ID: ${winningMessageId}`);
            
            // 获取跨链竞拍详情
            const [bidder, amount, sourceChain, isWinner] = await auction.getCrossChainBid(winningMessageId);
            console.log(`👤 跨链竞拍者: ${bidder}`);
            console.log(`💰 竞拍金额: ${amount} USD`);
            console.log(`🌐 源链: ${sourceChain}`);
            console.log(`🏆 是否获胜: ${isWinner}`);
        }
        
        // 所有跨链竞拍
        const crossChainBidIds = await auction.getCrossChainBidIds();
        console.log(`\n📝 跨链竞拍记录数: ${crossChainBidIds.length}`);
        
        for (let i = 0; i < crossChainBidIds.length; i++) {
            const messageId = crossChainBidIds[i];
            const [bidder, amount, sourceChain, isWinner] = await auction.getCrossChainBid(messageId);
            
            console.log(`\n--- 跨链竞拍 #${i + 1} ---`);
            console.log(`📨 消息ID: ${messageId}`);
            console.log(`👤 竞拍者: ${bidder}`);
            console.log(`💰 金额: ${amount} USD`);
            console.log(`🌐 源链: ${sourceChain}`);
            console.log(`🏆 获胜: ${isWinner ? "是" : "否"}`);
        }
        
        // 检查拍卖是否结束
        const currentTime = Math.floor(Date.now() / 1000);
        const auctionEndTime = Number(auctionStatus._startTime) + Number(auctionStatus._expirationTime);
        const isAuctionEnded = currentTime >= auctionEndTime;
        
        console.log(`\n⏰ 拍卖状态:`);
        console.log(`当前时间: ${new Date(currentTime * 1000).toLocaleString()}`);
        console.log(`结束时间: ${new Date(auctionEndTime * 1000).toLocaleString()}`);
        console.log(`拍卖状态: ${isAuctionEnded ? "已结束" : "进行中"}`);
        
        if (isAuctionEnded) {
            console.log(`\n💡 拍卖已结束，可以调用 endAuction() 函数`);
        }
        
        // 检查CCIP适配器状态
        if (CCIP_ADAPTER_ADDRESS !== "0x...") {
            console.log(`\n📡 CCIP适配器状态:`);
            const ccipAdapter = await ethers.getContractAt("CcipAdapter", CCIP_ADAPTER_ADDRESS);
            
            const [lastMessageId, lastBidder, lastAmount] = await ccipAdapter.getLastReceivedMessageDetails();
            console.log(`📨 最后消息ID: ${lastMessageId}`);
            console.log(`👤 最后竞拍者: ${lastBidder}`);
            console.log(`💰 最后金额: ${lastAmount}`);
        }
        
    } catch (error) {
        console.error("❌ 检查状态失败:", error.message);
        
        // 如果是合约地址问题，提供帮助信息
        if (error.message.includes("invalid address")) {
            console.log("\n💡 请确保:");
            console.log("1. 已正确部署合约");
            console.log("2. 在脚本中填入正确的合约地址");
            console.log("3. 在正确的网络上运行脚本");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
