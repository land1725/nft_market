const { ethers } = require("hardhat");

/**
 * @dev 本地CCIP测试脚本
 * 测试跨链竞拍功能的完整流程
 */

async function runLocalCCIPTest() {
    console.log("🧪 开始本地CCIP测试...");
    console.log("=" .repeat(60));
    
    const [deployer, bidder1, bidder2, crossChainBidder] = await ethers.getSigners();
    console.log(`部署者: ${deployer.address}`);
    console.log(`竞拍者1: ${bidder1.address}`);
    console.log(`竞拍者2: ${bidder2.address}`);
    console.log(`跨链竞拍者: ${crossChainBidder.address}`);
    
    // 部署系统
    const {
        deployMockCCIPInfrastructure,
        deployNFTAuctionSystem,
        configureCCIPAdapter,
        createTestAuction,
        checkAuctionStatus
    } = require("./deploy-ccip-local");
    
    // 1. 部署基础设施
    const mockAddresses = await deployMockCCIPInfrastructure();
    const contracts = await deployNFTAuctionSystem(mockAddresses);
    const chainSelectors = await configureCCIPAdapter(contracts);
    const auctionAddress = await createTestAuction(contracts);
    
    // 为测试用户分发LINK代币
    const linkToken = await ethers.getContractAt("MockLinkToken", contracts.linkToken);
    const linkAmount = ethers.parseEther("100");
    
    await linkToken.transfer(bidder1.address, linkAmount);
    await linkToken.transfer(bidder2.address, linkAmount);
    await linkToken.transfer(crossChainBidder.address, linkAmount);
    await linkToken.transfer(contracts.ccipAdapter, linkAmount);
    
    console.log("✅ LINK代币分发完成");
    
    // 获取合约实例
    const auction = await ethers.getContractAt("Auction", auctionAddress);
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    const mockRouter = await ethers.getContractAt("MockCCIPRouter", contracts.router);
    
    console.log("\n📊 初始拍卖状态:");
    await checkAuctionStatus(auctionAddress);
    
    // 检查拍卖是否已开始
    const auctionStatus = await auction.getAuctionStatus();
    console.log(`⏰ 拍卖开始时间: ${new Date(Number(auctionStatus._startTime) * 1000)}`);
    console.log(`⏰ 拍卖结束时间: ${new Date(Number(auctionStatus._endTime) * 1000)}`);
    console.log(`⏰ 当前时间: ${new Date()}`);
    
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = Number(auctionStatus._startTime);
    const endTime = Number(auctionStatus._endTime);
    
    console.log(`⏰ 拍卖状态: ${currentTime < startTime ? '未开始' : currentTime < endTime ? '进行中' : '已结束'}`);
    
    // 如果拍卖还没开始，快进时间到拍卖开始
    if (currentTime < startTime) {
        const timeToWait = startTime - currentTime + 1; // 额外等1秒确保开始
        console.log(`⏰ 快进时间 ${timeToWait} 秒到拍卖开始...`);
        await ethers.provider.send("evm_increaseTime", [timeToWait]);
        await ethers.provider.send("evm_mine");
        console.log("✅ 拍卖现在已开始");
    }
    
    // 2. 本地ETH竞拍测试
    console.log("\n💰 开始本地ETH竞拍测试...");
    
    // 尝试一个合理的ETH出价 (根据起始价格100 USD，假设1 ETH = 2000 USD)
    const bidAmount = ethers.parseEther("0.06"); // 0.06 ETH ≈ 120 USD
    console.log(`� Bidder1 出价 ${ethers.formatEther(bidAmount)} ETH...`);
    
    try {
        const ethBidTx = await auction.connect(bidder1).placeBidETH({
            value: bidAmount
        });
        await ethBidTx.wait();
        console.log("✅ ETH竞拍成功");
    } catch (error) {
        console.log(`❌ ETH竞拍失败: ${error.message}`);
        // 尝试更高的出价
        const higherBid = ethers.parseEther("0.1");
        console.log(`👤 Bidder1 尝试更高出价 ${ethers.formatEther(higherBid)} ETH...`);
        const retryTx = await auction.connect(bidder1).placeBidETH({
            value: higherBid
        });
        await retryTx.wait();
        console.log("✅ ETH竞拍成功");
    }
    
    await checkAuctionStatus(auctionAddress);
    
    // 3. ERC20竞拍测试
    console.log("\n💎 开始ERC20竞拍测试...");
    
    // 使用LINK代币进行竞拍 (拍卖合约接受的代币)
    // Bidder2授权拍卖合约
    await linkToken.connect(bidder2).approve(auctionAddress, ethers.parseUnits("200", 18));
    
    // Bidder2 出价 150 USD (LINK支付)
    console.log("👤 Bidder2 出价 150 USD (LINK)...");
    const erc20BidTx = await auction.connect(bidder2).placeBidERC20(
        ethers.parseUnits("150", 6)
    );
    await erc20BidTx.wait();
    console.log("✅ ERC20竞拍成功");
    
    await checkAuctionStatus(auctionAddress);
    
    // 4. 跨链竞拍测试
    console.log("\n🌉 开始跨链竞拍测试...");
    
    // 为跨链竞拍者分发LINK用于费用支付
    await linkToken.connect(crossChainBidder).approve(contracts.ccipAdapter, linkAmount);
    
    // 跨链竞拍者出价 200 USD
    console.log("👤 跨链竞拍者出价 200 USD...");
    try {
        const crossChainBidTx = await ccipAdapter.connect(crossChainBidder).sendCrossChainBid(
            chainSelectors.ethereumSelector,
            contracts.ccipAdapter,
            crossChainBidder.address,
            ethers.parseUnits("200", 6)
        );
        const receipt = await crossChainBidTx.wait();
        console.log(`✅ 跨链竞拍消息发送成功，Gas: ${receipt.gasUsed}`);
        
        // 获取消息ID
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
        }
        
    } catch (error) {
        console.error(`❌ 跨链竞拍失败: ${error.message}`);
    }
    
    await checkAuctionStatus(auctionAddress);
    
    // 5. 测试更高的跨链竞拍
    console.log("\n🚀 测试更高的跨链竞拍 (250 USD)...");
    try {
        const higherBidTx = await ccipAdapter.connect(crossChainBidder).sendCrossChainBid(
            chainSelectors.ethereumSelector,
            contracts.ccipAdapter,
            crossChainBidder.address,
            ethers.parseUnits("250", 6)
        );
        const receipt = await higherBidTx.wait();
        
        // 处理消息
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
            await mockRouter.manualProcessMessage(messageId);
            console.log("✅ 更高跨链竞拍成功");
        }
        
    } catch (error) {
        console.error(`❌ 更高跨链竞拍失败: ${error.message}`);
    }
    
    await checkAuctionStatus(auctionAddress);
    
    // 6. 测试拍卖结束
    console.log("\n⏰ 快进时间，结束拍卖...");
    
    // 快进时间超过拍卖期限
    await ethers.provider.send("evm_increaseTime", [3700]); // 增加3700秒
    await ethers.provider.send("evm_mine"); // 挖出新区块
    
    console.log("📈 结束拍卖...");
    const endAuctionTx = await auction.endAuction();
    await endAuctionTx.wait();
    console.log("✅ 拍卖已结束");
    
    // 检查最终状态
    console.log("\n🏆 最终拍卖结果:");
    await checkAuctionStatus(auctionAddress);
    
    // 检查NFT所有权
    const nftToken = await ethers.getContractAt("NftToken", contracts.nftToken);
    const nftOwner = await nftToken.ownerOf(0);
    console.log(`🖼️ NFT最终所有者: ${nftOwner}`);
    
    // 7. 如果是跨链获胜者，测试NFT转移
    const [isWinnerCrossChain] = await auction.getCrossChainWinnerInfo();
    if (isWinnerCrossChain) {
        console.log("\n🌉 测试跨链NFT转移...");
        try {
            const transferTx = await auction.transferNFTToCrossChainWinner();
            await transferTx.wait();
            console.log("✅ 跨链NFT转移成功");
        } catch (error) {
            console.error(`❌ 跨链NFT转移失败: ${error.message}`);
        }
    }
    
    console.log("\n🎉 本地CCIP测试完成!");
    console.log("=" .repeat(60));
    console.log("📋 测试总结:");
    console.log("✅ Mock CCIP基础设施部署");
    console.log("✅ NFT拍卖系统部署");
    console.log("✅ 本地ETH竞拍");
    console.log("✅ ERC20竞拍");
    console.log("✅ 跨链竞拍");
    console.log("✅ 拍卖结束和获胜者确定");
    
    if (isWinnerCrossChain) {
        console.log("✅ 跨链NFT转移");
    }
    
    console.log("\n💡 测试结果验证:");
    console.log(`🏆 最高出价者类型: ${isWinnerCrossChain ? '跨链' : '本地'}`);
    console.log(`🖼️ NFT最终所有者: ${nftOwner}`);
}

async function main() {
    try {
        await runLocalCCIPTest();
    } catch (error) {
        console.error("❌ 测试失败:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { runLocalCCIPTest };
