const { ethers } = require("hardhat");

async function testCrossChainBid() {
    console.log("🌉 测试跨链竞拍功能...");
    
    const [deployer, bidder1, bidder2, crossChainBidder] = await ethers.getSigners();
    
    // 使用最新部署的合约地址
    const contracts = {
        linkToken: "0x22753E4264FDDc6181dc7cce468904A80a363E44",
        router: "0xA7c59f010700930003b33aB25a7a0679C860f29c", 
        ccipAdapter: "0x3155755b79aA083bd953911C92705B7aA82a18F9",
        nftToken: "0x276C216D241856199A83bf27b2286659e5b877D3",
        auctionFactory: "0x3347B4d90ebe72BeFb30444C9966B2B990aE9FcB",
        priceOracle: "0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c",
        auction: "0xF8A8B047683062B5BBbbe9D104C9177d6b6cC086"
    };
    
    // 获取合约实例
    const linkToken = await ethers.getContractAt("MockLinkToken", contracts.linkToken);
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    const auction = await ethers.getContractAt("Auction", contracts.auction);
    const mockRouter = await ethers.getContractAt("MockCCIPRouter", contracts.router);
    
    // 定义链选择器 (localhost网络默认返回Sepolia选择器)
    const ethereumSelector = "16015286601757825753"; // Sepolia (localhost默认)
    
    console.log("📊 检查拍卖状态...");
    const auctionStatus = await auction.getAuctionStatus();
    console.log(`💰 起始价格: ${ethers.formatUnits(auctionStatus._startingPrice, 6)} USD`);
    console.log(`📈 当前最高出价: ${ethers.formatUnits(auctionStatus._highestUSD, 6)} USD`);
    
    // 为跨链竞拍者分发LINK代币
    console.log("💰 为跨链竞拍者分发LINK...");
    const linkAmount = ethers.parseEther("10");
    await linkToken.transfer(crossChainBidder.address, linkAmount);
    
    // 跨链竞拍者授权CCIP适配器使用LINK
    console.log("✅ 授权CCIP适配器使用LINK...");
    await linkToken.connect(crossChainBidder).approve(contracts.ccipAdapter, linkAmount);
    
    // 检查授权
    const allowance = await linkToken.allowance(crossChainBidder.address, contracts.ccipAdapter);
    console.log(`📝 LINK授权金额: ${ethers.formatEther(allowance)} LINK`);
    
    // 确保链选择器被允许
    console.log("🔧 配置链选择器...");
    
    // 检查当前配置
    const isSourceAllowed = await ccipAdapter.allowlistedSourceChains(ethereumSelector);
    const isDestAllowed = await ccipAdapter.allowlistedDestinationChains(ethereumSelector);
    console.log(`📡 以太坊作为源链是否允许: ${isSourceAllowed}`);
    console.log(`📡 以太坊作为目标链是否允许: ${isDestAllowed}`);
    
    if (!isSourceAllowed) {
        console.log("🔧 允许以太坊作为源链...");
        await ccipAdapter.allowlistSourceChain(ethereumSelector, true);
    }
    if (!isDestAllowed) {
        console.log("🔧 允许以太坊作为目标链...");
        await ccipAdapter.allowlistDestinationChain(ethereumSelector, true);
    }
    
    // 发送跨链竞拍
    const bidAmount = ethers.parseUnits("12", 6); // 12 USD (高于10 USD起拍价)
    
    console.log(`🌉 发送跨链竞拍 ${ethers.formatUnits(bidAmount, 6)} USD...`);
    try {
        const tx = await ccipAdapter.connect(crossChainBidder).sendCrossChainBid(
            ethereumSelector,
            contracts.ccipAdapter,
            crossChainBidder.address,
            bidAmount
        );
        const receipt = await tx.wait();
        console.log(`✅ 跨链竞拍消息发送成功，Gas: ${receipt.gasUsed}`);
        
        // 查找MessageSent事件
        const events = receipt.logs.filter(log => {
            try {
                const parsed = ccipAdapter.interface.parseLog(log);
                return parsed && parsed.name === "MessageSent";
            } catch {
                return false;
            }
        });
        
        if (events.length > 0) {
            const parsed = ccipAdapter.interface.parseLog(events[0]);
            const messageId = parsed.args.messageId;
            console.log(`📨 CCIP消息ID: ${messageId}`);
            
            // 手动处理消息 (模拟CCIP网络处理)
            console.log("⏳ 处理CCIP消息...");
            await mockRouter.manualProcessMessage(messageId);
            console.log("✅ CCIP消息处理完成");
            
            // 检查拍卖状态
            console.log("\n📊 处理后的拍卖状态:");
            const newStatus = await auction.getAuctionStatus();
            console.log(`💰 当前最高出价: ${ethers.formatUnits(newStatus._highestUSD, 6)} USD`);
            console.log(`👤 当前最高出价者: ${newStatus._highestBidder}`);
            
            // 检查跨链获胜者信息
            const [isWinnerCrossChain, winningMessageId] = await auction.getCrossChainWinnerInfo();
            console.log(`🌉 是否跨链获胜者: ${isWinnerCrossChain}`);
            
            if (isWinnerCrossChain) {
                console.log(`📨 获胜消息ID: ${winningMessageId}`);
                const [bidder, amount, sourceChain, isWinner] = await auction.getCrossChainBid(winningMessageId);
                console.log(`👤 跨链竞拍者: ${bidder}`);
                console.log(`💰 竞拍金额: ${ethers.formatUnits(amount, 6)} USD`);
                console.log(`🌐 源链: ${sourceChain}`);
                console.log(`🏆 是否获胜: ${isWinner}`);
            }
            
            console.log("\n🎉 跨链竞拍测试成功完成!");
        }
        
    } catch (error) {
        console.error(`❌ 跨链竞拍失败: ${error.message}`);
    }
}

async function main() {
    try {
        await testCrossChainBid();
    } catch (error) {
        console.error("❌ 测试失败:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
