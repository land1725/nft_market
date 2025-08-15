const { ethers } = require("hardhat");

/**
 * @dev CCIP Local部署脚本
 * 使用Chainlink CCIP Local进行本地测试
 * 需要先启动CCIP Local节点
 */

// CCIP Local配置 (默认配置)
const CCIP_LOCAL_CONFIG = {
    // 模拟链配置
    chains: {
        ethereum: {
            chainId: 1,
            chainSelector: "5009297550715157269", // Ethereum Mainnet
            rpcUrl: "http://localhost:8545",
            router: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D", // CCIP Local默认路由器
            linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA"
        },
        polygon: {
            chainId: 137,
            chainSelector: "4051577828743386545", // Polygon Mainnet  
            rpcUrl: "http://localhost:8546",
            router: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe",
            linkToken: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1"
        }
    }
};

async function deployMockCCIPInfrastructure() {
    console.log("🏗️ 部署Mock CCIP基础设施...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`部署者账户: ${deployer.address}`);
    
    // 部署Mock LINK代币
    console.log("📄 部署Mock LINK代币...");
    const MockLINK = await ethers.getContractFactory("MockLinkToken");
    const linkToken = await MockLINK.deploy(
        "Mock LINK", 
        "LINK",
        18,
        ethers.parseEther("1000000") // 1M LINK初始供应量
    );
    await linkToken.waitForDeployment();
    const linkAddress = await linkToken.getAddress();
    console.log(`✅ Mock LINK Token: ${linkAddress}`);
    
    // 部署Mock CCIP路由器
    console.log("🚀 部署Mock CCIP路由器...");
    const MockCCIPRouter = await ethers.getContractFactory("MockCCIPRouter");
    const router = await MockCCIPRouter.deploy(linkAddress);
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log(`✅ Mock CCIP Router: ${routerAddress}`);
    
    return {
        linkToken: linkAddress,
        router: routerAddress
    };
}

async function deployNFTAuctionSystem(mockAddresses) {
    console.log("\n🎨 部署NFT拍卖系统...");
    
    const [deployer] = await ethers.getSigners();
    
    // 1. 部署Price Oracle
    console.log("📊 部署Price Oracle...");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();
    const oracleAddress = await priceOracle.getAddress();
    console.log(`✅ Price Oracle: ${oracleAddress}`);
    
    // 2. 部署NFT Token
    console.log("🖼️ 部署NFT Token...");
    const NftToken = await ethers.getContractFactory("NftToken");
    const nftToken = await NftToken.deploy(deployer.address);
    await nftToken.waitForDeployment();
    const nftAddress = await nftToken.getAddress();
    console.log(`✅ NFT Token: ${nftAddress}`);
    
    // 3. 部署Auction Factory
    console.log("🏭 部署Auction Factory...");
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    const auctionFactory = await AuctionFactory.deploy();
    await auctionFactory.waitForDeployment();
    const factoryAddress = await auctionFactory.getAddress();
    console.log(`✅ Auction Factory: ${factoryAddress}`);
    
    // 4. 部署CCIP Adapter
    console.log("🌉 部署CCIP Adapter...");
    const CcipAdapter = await ethers.getContractFactory("CcipAdapter");
    const ccipAdapter = await CcipAdapter.deploy(
        mockAddresses.router,
        mockAddresses.linkToken
    );
    await ccipAdapter.waitForDeployment();
    const adapterAddress = await ccipAdapter.getAddress();
    console.log(`✅ CCIP Adapter: ${adapterAddress}`);
    
    return {
        priceOracle: oracleAddress,
        nftToken: nftAddress,
        auctionFactory: factoryAddress,
        ccipAdapter: adapterAddress,
        linkToken: mockAddresses.linkToken,
        router: mockAddresses.router
    };
}

async function configureCCIPAdapter(contracts) {
    console.log("\n⚙️ 配置CCIP Adapter...");
    
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    
    // 配置链选择器 (使用模拟值)
    const ethereumSelector = "5009297550715157269";
    const polygonSelector = "4051577828743386545";
    const sepoliaSelector = "16015286601757825753"; // localhost默认返回Sepolia选择器
    
    console.log("🔗 配置允许的链...");
    
    // 允许以太坊、Polygon和Sepolia作为源链和目标链
    await ccipAdapter.allowlistSourceChain(ethereumSelector, true);
    await ccipAdapter.allowlistDestinationChain(ethereumSelector, true);
    await ccipAdapter.allowlistSourceChain(polygonSelector, true);
    await ccipAdapter.allowlistDestinationChain(polygonSelector, true);
    await ccipAdapter.allowlistSourceChain(sepoliaSelector, true);
    await ccipAdapter.allowlistDestinationChain(sepoliaSelector, true);
    
    console.log(`✅ 允许以太坊链选择器: ${ethereumSelector}`);
    console.log(`✅ 允许Polygon链选择器: ${polygonSelector}`);
    console.log(`✅ 允许Sepolia链选择器: ${sepoliaSelector}`);
    
    // 允许自己作为发送者
    await ccipAdapter.allowlistSender(contracts.ccipAdapter, true);
    console.log(`✅ 允许自身作为发送者: ${contracts.ccipAdapter}`);
    
    return {
        ethereumSelector,
        polygonSelector,
        sepoliaSelector
    };
}

async function createTestAuction(contracts) {
    console.log("\n🎯 创建测试拍卖...");
    
    const [deployer] = await ethers.getSigners();
    
    // 铸造测试NFT
    console.log("🎨 铸造测试NFT...");
    const nftToken = await ethers.getContractAt("NftToken", contracts.nftToken);
    const tokenURI = "ipfs://QmTestCCIPLocal" + Date.now();
    const mintTx = await nftToken.safeMint(deployer.address, tokenURI);
    await mintTx.wait();
    console.log(`✅ NFT铸造成功，TokenID: 0`);
    
    // 授权给拍卖工厂
    const approveTx = await nftToken.approve(contracts.auctionFactory, 0);
    await approveTx.wait();
    console.log(`✅ NFT已授权给拍卖工厂`);
    
    // 创建拍卖
    console.log("📈 创建拍卖...");
    const auctionFactory = await ethers.getContractAt("AuctionFactory", contracts.auctionFactory);
    
    const createTx = await auctionFactory.createAuction(
        contracts.linkToken,  // payment token
        contracts.nftToken,   // nft contract
        0,                    // token id
        ethers.parseUnits("10", 6), // USD price (10 USD起拍价，6位小数)
        ethers.parseUnits("1", 6),  // min bid increment (1 USD最小加价，6位小数)
        3600,                 // duration (1 hour)
        contracts.priceOracle // price oracle
    );
    
    const receipt = await createTx.wait();
    console.log(`✅ 拍卖创建成功，Gas使用: ${receipt.gasUsed}`);
    
    // 获取拍卖合约地址
    const auctionAddress = await auctionFactory.Auctions(0);
    console.log(`✅ 拍卖合约地址: ${auctionAddress}`);
    
    // 配置拍卖合约的CCIP适配器
    const auction = await ethers.getContractAt("Auction", auctionAddress);
    await auction.setCcipAdapter(contracts.ccipAdapter);
    console.log(`✅ 拍卖合约已配置CCIP适配器`);
    
    // 配置CCIP适配器的拍卖合约
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    await ccipAdapter.setAuctionContract(auctionAddress);
    console.log(`✅ CCIP适配器已配置拍卖合约`);
    
    return auctionAddress;
}

async function fundCCIPAdapter(contracts) {
    console.log("\n💰 为CCIP适配器提供LINK代币...");
    
    const [deployer] = await ethers.getSigners();
    const linkToken = await ethers.getContractAt("MockLinkToken", contracts.linkToken);
    
    // 转移一些LINK给CCIP适配器用于支付费用
    const linkAmount = ethers.parseEther("100"); // 100 LINK
    const transferTx = await linkToken.transfer(contracts.ccipAdapter, linkAmount);
    await transferTx.wait();
    
    const balance = await linkToken.balanceOf(contracts.ccipAdapter);
    console.log(`✅ CCIP适配器LINK余额: ${ethers.formatEther(balance)} LINK`);
}

async function testCrossChainBid(contracts, chainSelectors, auctionAddress) {
    console.log("\n🌉 测试跨链竞拍...");
    
    const [deployer, bidder] = await ethers.getSigners();
    const ccipAdapter = await ethers.getContractAt("CcipAdapter", contracts.ccipAdapter);
    const linkToken = await ethers.getContractAt("MockLinkToken", contracts.linkToken);
    
    // 为竞拍者提供LINK代币
    console.log("💰 为竞拍者分发LINK代币...");
    const linkAmount = ethers.parseEther("10"); // 10 LINK
    await linkToken.transfer(bidder.address, linkAmount);
    
    // 竞拍者授权CCIP Adapter使用LINK
    console.log("✅ 竞拍者授权CCIP Adapter使用LINK...");
    await linkToken.connect(bidder).approve(contracts.ccipAdapter, linkAmount);
    
    const allowance = await linkToken.allowance(bidder.address, contracts.ccipAdapter);
    console.log(`📝 LINK授权金额: ${ethers.formatEther(allowance)} LINK`);
    
    // 模拟从Polygon向Ethereum发送跨链竞拍
    const bidAmount = ethers.parseUnits("150", 6); // 150 USD
    
    console.log(`💰 发送跨链竞拍...`);
    console.log(`竞拍者: ${bidder.address}`);
    console.log(`竞拍金额: ${ethers.formatUnits(bidAmount, 6)} USD`);
    
    try {
        const tx = await ccipAdapter.connect(bidder).sendCrossChainBid(
            chainSelectors.sepoliaSelector,  // 目标链 (localhost使用Sepolia选择器)
            contracts.ccipAdapter,           // 接收合约 (同一个适配器)
            bidder.address,                  // 竞拍者
            bidAmount                        // 竞拍金额
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
            
            // 模拟CCIP消息处理 (在实际CCIP Local中会自动处理)
            console.log("⏳ 模拟CCIP消息处理...");
            
            // 检查竞拍状态
            await checkAuctionStatus(auctionAddress);
            
            return messageId;
        }
        
    } catch (error) {
        console.error(`❌ 跨链竞拍失败: ${error.message}`);
    }
}

async function checkAuctionStatus(auctionAddress) {
    console.log("\n📊 检查拍卖状态...");
    
    const auction = await ethers.getContractAt("Auction", auctionAddress);
    
    // 获取基本状态
    const auctionStatus = await auction.getAuctionStatus();
    console.log(`💰 当前最高出价: ${auctionStatus._highestUSD} USD`);
    console.log(`👤 当前最高出价者: ${auctionStatus._highestBidder}`);
    
    // 检查跨链获胜者信息
    const [isWinnerCrossChain, winningMessageId] = await auction.getCrossChainWinnerInfo();
    console.log(`🌉 是否跨链获胜者: ${isWinnerCrossChain}`);
    
    if (isWinnerCrossChain) {
        console.log(`📨 获胜消息ID: ${winningMessageId}`);
        
        // 获取跨链竞拍详情
        const [bidder, amount, sourceChain, isWinner] = await auction.getCrossChainBid(winningMessageId);
        console.log(`👤 跨链竞拍者: ${bidder}`);
        console.log(`💰 竞拍金额: ${amount} USD`);
        console.log(`🌐 源链: ${sourceChain}`);
        console.log(`🏆 是否获胜: ${isWinner}`);
    }
    
    // 获取所有跨链竞拍
    const crossChainBidIds = await auction.getCrossChainBidIds();
    console.log(`📝 跨链竞拍总数: ${crossChainBidIds.length}`);
}

async function main() {
    console.log("🚀 开始CCIP Local部署和测试...");
    console.log("=" .repeat(60));
    
    try {
        // 1. 部署Mock CCIP基础设施
        const mockAddresses = await deployMockCCIPInfrastructure();
        
        // 2. 部署NFT拍卖系统
        const contracts = await deployNFTAuctionSystem(mockAddresses);
        
        // 3. 配置CCIP适配器
        const chainSelectors = await configureCCIPAdapter(contracts);
        
        // 4. 创建测试拍卖
        const auctionAddress = await createTestAuction(contracts);
        
        // 5. 为CCIP适配器提供资金
        await fundCCIPAdapter(contracts);
        
        // 6. 测试跨链竞拍
        const messageId = await testCrossChainBid(contracts, chainSelectors, auctionAddress);
        
        console.log("\n🎉 CCIP Local部署和测试完成!");
        console.log("=" .repeat(60));
        console.log("📋 部署摘要:");
        console.log(`🔗 LINK Token: ${contracts.linkToken}`);
        console.log(`🚀 CCIP Router: ${contracts.router}`);
        console.log(`🌉 CCIP Adapter: ${contracts.ccipAdapter}`);
        console.log(`🖼️ NFT Token: ${contracts.nftToken}`);
        console.log(`🏭 Auction Factory: ${contracts.auctionFactory}`);
        console.log(`📊 Price Oracle: ${contracts.priceOracle}`);
        console.log(`🎯 Test Auction: ${auctionAddress}`);
        
        if (messageId) {
            console.log(`📨 Test Message ID: ${messageId}`);
        }
        
        console.log("\n💡 下一步:");
        console.log("1. 运行本地ETH竞拍测试");
        console.log("2. 运行更多跨链竞拍测试");
        console.log("3. 测试拍卖结束和NFT转移");
        
    } catch (error) {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    }
}

// 只有直接运行此脚本时才执行main函数
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    deployMockCCIPInfrastructure,
    deployNFTAuctionSystem,
    configureCCIPAdapter,
    createTestAuction,
    testCrossChainBid,
    checkAuctionStatus
};
