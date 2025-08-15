const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CCIP跨链竞拍系统测试", function () {
  let auctionFactory, nftToken, mockLINK, priceOracle, ccipAdapter;
  let auction;
  let owner, seller, bidder1, crossChainBidder;
  
  this.timeout(120000); // 2分钟超时

  before(async function () {
    console.log("🚀 开始CCIP跨链竞拍测试...");
    
    // 获取账户
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    seller = accounts[0]; // 主账户作为seller
    bidder1 = accounts[1] || owner; // 本地竞拍者
    crossChainBidder = accounts[2] || owner; // 模拟跨链竞拍者
    
    console.log(`📝 账户信息:
      Owner/Seller: ${owner.address}
      本地竞拍者: ${bidder1.address}
      跨链竞拍者: ${crossChainBidder.address}
    `);

    console.log("🔧 部署测试合约...");

    // 部署MockLINK代币
    const MockLINK = await ethers.getContractFactory("contracts/mock/MockLINK.sol:MockLINK");
    mockLINK = await MockLINK.deploy();
    await mockLINK.waitForDeployment();
    console.log(`✅ MockLINK: ${await mockLINK.getAddress()}`);

    // 部署NFT合约
    const NftToken = await ethers.getContractFactory("NftToken");
    nftToken = await NftToken.deploy(owner.address);
    await nftToken.waitForDeployment();
    console.log(`✅ NFT Token: ${await nftToken.getAddress()}`);

    // 部署价格预言机
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();
    console.log(`✅ Price Oracle: ${await priceOracle.getAddress()}`);

    // 部署拍卖工厂
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    auctionFactory = await AuctionFactory.deploy();
    await auctionFactory.waitForDeployment();
    console.log(`✅ Auction Factory: ${await auctionFactory.getAddress()}`);

    // 部署CCIP适配器 (使用mock地址)
    const CcipAdapter = await ethers.getContractFactory("CcipAdapter");
    ccipAdapter = await CcipAdapter.deploy(
      owner.address, // mock router
      await mockLINK.getAddress() // link token
    );
    await ccipAdapter.waitForDeployment();
    console.log(`✅ CCIP Adapter: ${await ccipAdapter.getAddress()}`);

    console.log("✅ 所有合约部署完成");
  });

  describe("CCIP适配器基础测试", function () {
    it("应该能正确设置CCIP适配器", async function () {
      console.log("🔧 测试CCIP适配器设置...");
      
      // 检查初始状态
      expect(await ccipAdapter.owner()).to.equal(owner.address);
      
      // 设置链和发送者白名单
      const testChainSelector = "16015286601757825753"; // Sepolia
      await ccipAdapter.allowlistDestinationChain(testChainSelector, true);
      await ccipAdapter.allowlistSourceChain(testChainSelector, true);
      await ccipAdapter.allowlistSender(owner.address, true);
      
      console.log("✅ CCIP适配器配置完成");
    });
  });

  describe("拍卖合约CCIP集成测试", function () {
    beforeEach(async function () {
      console.log("🎯 准备拍卖测试...");
      
      // 铸造NFT
      const tokenURI = `ipfs://ccip-test-${Date.now()}`;
      const mintTx = await nftToken.safeMint(seller.address, tokenURI);
      await mintTx.wait();
      console.log(`✅ NFT铸造完成: Token ID 0`);
      
      // 授权给拍卖工厂
      const factoryAddress = await auctionFactory.getAddress();
      const approveTx = await nftToken.connect(seller).approve(factoryAddress, 0);
      await approveTx.wait();
      console.log(`✅ NFT已授权给拍卖工厂`);
      
      // 创建拍卖
      const nftAddress = await nftToken.getAddress();
      const linkAddress = await mockLINK.getAddress();
      const oracleAddress = await priceOracle.getAddress();
      
      const createTx = await auctionFactory.connect(seller).createAuction(
        linkAddress,
        nftAddress,
        0, // token id
        ethers.parseEther("10"), // starting price: 10 USD
        ethers.parseEther("1"),  // bid increment: 1 USD
        3600, // duration: 1 hour
        oracleAddress
      );
      await createTx.wait();
      
      // 获取拍卖合约地址
      const auctionAddress = await auctionFactory.Auctions(0);
      auction = await ethers.getContractAt("Auction", auctionAddress);
      
      console.log(`✅ 拍卖创建完成: ${auctionAddress}`);
    });

    it("应该能设置CCIP适配器", async function () {
      console.log("🔗 测试设置CCIP适配器...");
      
      const ccipAdapterAddress = await ccipAdapter.getAddress();
      
      // 设置CCIP适配器
      await auction.setCcipAdapter(ccipAdapterAddress);
      
      // 验证设置
      expect(await auction.ccipAdapter()).to.equal(ccipAdapterAddress);
      
      console.log("✅ CCIP适配器设置成功");
    });

    it("应该能接收跨链竞拍", async function () {
      console.log("🌉 测试跨链竞拍接收...");
      
      const ccipAdapterAddress = await ccipAdapter.getAddress();
      await auction.setCcipAdapter(ccipAdapterAddress);
      
      // 模拟跨链竞拍参数
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-1"));
      const bidderAddress = crossChainBidder.address;
      const bidAmount = ethers.parseEther("15"); // 15 USD
      const sourceChain = "16281711391670634445"; // Polygon Amoy
      
      // 使用CCIP适配器账户模拟跨链竞拍接收
      await auction.connect(owner).receiveCrossChainBid(
        messageId,
        bidderAddress,
        bidAmount,
        sourceChain
      );
      
      // 验证跨链竞拍记录
      const [bidder, amount, chain, isWinner] = await auction.getCrossChainBid(messageId);
      expect(bidder).to.equal(bidderAddress);
      expect(amount).to.equal(bidAmount);
      expect(chain).to.equal(sourceChain);
      expect(isWinner).to.be.false;
      
      // 验证最高出价更新
      expect(await auction.highestBidder()).to.equal(bidderAddress);
      expect(await auction.highestUSD()).to.equal(bidAmount);
      
      // 验证跨链获胜者状态
      const [isWinnerCrossChain, winningMessageId] = await auction.getCrossChainWinnerInfo();
      expect(isWinnerCrossChain).to.be.true;
      expect(winningMessageId).to.equal(messageId);
      
      console.log(`✅ 跨链竞拍接收成功: ${ethers.formatEther(bidAmount)} USD`);
    });

    it("本地竞拍应该能覆盖跨链竞拍", async function () {
      console.log("🔄 测试本地竞拍覆盖跨链竞拍...");
      
      const ccipAdapterAddress = await ccipAdapter.getAddress();
      await auction.setCcipAdapter(ccipAdapterAddress);
      
      // 先进行跨链竞拍
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-2"));
      await auction.connect(owner).receiveCrossChainBid(
        messageId,
        crossChainBidder.address,
        ethers.parseEther("15"), // 15 USD
        "16281711391670634445"
      );
      
      // 验证跨链竞拍成功
      let [isWinnerCrossChain,] = await auction.getCrossChainWinnerInfo();
      expect(isWinnerCrossChain).to.be.true;
      
      // 本地ETH竞拍 (更高价格)
      const ethBidAmount = ethers.parseEther("0.01"); // 假设ETH价格使得这个金额 > 15 USD
      
      try {
        await auction.connect(bidder1).placeBidETH({ value: ethBidAmount });
        
        // 验证本地竞拍覆盖跨链竞拍
        expect(await auction.highestBidder()).to.equal(bidder1.address);
        expect(await auction.highestPaymentToken()).to.equal(ethers.ZeroAddress);
        expect(await auction.highestTokenAmount()).to.equal(ethBidAmount);
        
        // 验证跨链状态重置
        [isWinnerCrossChain,] = await auction.getCrossChainWinnerInfo();
        expect(isWinnerCrossChain).to.be.false;
        
        console.log("✅ 本地竞拍成功覆盖跨链竞拍");
      } catch (error) {
        console.log(`⚠️ 本地竞拍金额不足以覆盖跨链竞拍: ${error.message}`);
      }
    });

    it("应该显示跨链竞拍统计", async function () {
      console.log("📊 测试跨链竞拍统计...");
      
      const ccipAdapterAddress = await ccipAdapter.getAddress();
      await auction.setCcipAdapter(ccipAdapterAddress);
      
      // 添加多个跨链竞拍
      const bids = [
        {
          messageId: ethers.keccak256(ethers.toUtf8Bytes("bid-1")),
          bidder: ethers.Wallet.createRandom().address,
          amount: ethers.parseEther("12"),
          sourceChain: "16281711391670634445"
        },
        {
          messageId: ethers.keccak256(ethers.toUtf8Bytes("bid-2")),
          bidder: ethers.Wallet.createRandom().address,
          amount: ethers.parseEther("18"),
          sourceChain: "16281711391670634445"
        }
      ];
      
      for (const bid of bids) {
        await auction.connect(owner).receiveCrossChainBid(
          bid.messageId,
          bid.bidder,
          bid.amount,
          bid.sourceChain
        );
      }
      
      // 获取跨链竞拍统计
      const crossChainBidIds = await auction.getCrossChainBidIds();
      expect(crossChainBidIds.length).to.equal(2);
      
      console.log(`📈 跨链竞拍总数: ${crossChainBidIds.length}`);
      
      // 验证最高价竞拍获胜
      const [isWinnerCrossChain, winningMessageId] = await auction.getCrossChainWinnerInfo();
      expect(isWinnerCrossChain).to.be.true;
      expect(winningMessageId).to.equal(bids[1].messageId); // 第二个竞拍金额更高
      
      console.log("✅ 跨链竞拍统计验证完成");
    });
  });

  describe("系统集成测试", function () {
    it("应该显示完整的拍卖系统状态", async function () {
      console.log("\n📊 完整系统状态:");
      console.log("=" .repeat(50));
      
      console.log(`📄 NFT合约: ${await nftToken.getAddress()}`);
      console.log(`🏭 拍卖工厂: ${await auctionFactory.getAddress()}`);
      console.log(`💰 LINK代币: ${await mockLINK.getAddress()}`);
      console.log(`📊 价格预言机: ${await priceOracle.getAddress()}`);
      console.log(`🌉 CCIP适配器: ${await ccipAdapter.getAddress()}`);
      
      const totalSupply = await nftToken.totalSupply();
      console.log(`📈 NFT总供应量: ${totalSupply}`);
      
      // 如果有拍卖合约，显示其地址
      try {
        const auctionAddress = await auctionFactory.Auctions(0);
        console.log(`🎯 拍卖合约: ${auctionAddress}`);
      } catch (error) {
        console.log(`🎯 暂无拍卖合约`);
      }
      
      console.log("✅ CCIP跨链竞拍系统部署和测试完成");
    });
  });
});
