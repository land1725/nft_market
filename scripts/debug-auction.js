const { ethers } = require("hardhat");

async function debugAuction() {
    console.log("🔍 调试拍卖合约...");
    
    const [deployer, bidder1] = await ethers.getSigners();
    
    // 使用已部署的合约地址 (从上次运行的输出)
    const auctionFactoryAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"; // 从localhost部署日志获取
    const auctionFactory = await ethers.getContractAt("AuctionFactory", auctionFactoryAddress);
    
    // 获取第一个拍卖地址
    const auctionAddress = await auctionFactory.Auctions(0);
    console.log(`🎯 拍卖地址: ${auctionAddress}`);
    
    const auction = await ethers.getContractAt("Auction", auctionAddress);
    
    // 检查拍卖状态
    const auctionStatus = await auction.getAuctionStatus();
    console.log(`💰 起始价格: ${ethers.formatUnits(auctionStatus._startingPrice, 6)} USD`);
    console.log(`📈 竞拍增量: ${ethers.formatUnits(auctionStatus._bidIncrement, 6)} USD`);
    console.log(`💰 当前最高出价: ${ethers.formatUnits(auctionStatus._highestUSD, 6)} USD`);
    console.log(`👤 当前最高出价者: ${auctionStatus._highestBidder}`);
    console.log(`⏰ 开始时间: ${new Date(Number(auctionStatus._startTime) * 1000)}`);
    console.log(`⏰ 结束时间: ${new Date(Number(auctionStatus._endTime) * 1000)}`);
    
    // 检查价格Oracle
    const priceOracleAddress = await auction.priceOracle();
    console.log(`📊 价格Oracle: ${priceOracleAddress}`);
    
    const priceOracle = await ethers.getContractAt("PriceOracle", priceOracleAddress);
    const testEthAmount = ethers.parseEther("0.1");
    
    try {
        const testUsdValue = await priceOracle.convertEthToUsd(testEthAmount);
        console.log(`💱 价格转换: ${ethers.formatEther(testEthAmount)} ETH = ${ethers.formatUnits(testUsdValue, 6)} USD`);
        
        // 计算满足最低要求的ETH数量
        const startingPrice = auctionStatus._startingPrice;
        const neededUsd = startingPrice + ethers.parseUnits("10", 6); // 起始价格 + 10 USD
        
        // 假设1 ETH = 2000 USD (根据Oracle实现)
        const neededEth = (neededUsd * ethers.parseEther("1")) / ethers.parseUnits("2000", 6);
        console.log(`🎯 需要的ETH数量: ${ethers.formatEther(neededEth)} ETH (约 ${ethers.formatUnits(neededUsd, 6)} USD)`);
        
        // 尝试竞拍
        console.log(`👤 尝试ETH竞拍...`);
        const bidTx = await auction.connect(bidder1).placeBidETH({
            value: neededEth
        });
        await bidTx.wait();
        console.log("✅ ETH竞拍成功!");
        
        // 检查更新后的状态
        const newStatus = await auction.getAuctionStatus();
        console.log(`💰 新的最高出价: ${ethers.formatUnits(newStatus._highestUSD, 6)} USD`);
        console.log(`👤 新的最高出价者: ${newStatus._highestBidder}`);
        
    } catch (error) {
        console.log(`❌ 价格转换或竞拍失败: ${error.message}`);
    }
}

async function main() {
    try {
        await debugAuction();
    } catch (error) {
        console.error("❌ 调试失败:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
