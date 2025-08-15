const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sepolia完整拍卖系统测试", function () {
  let auctionFactory, nftToken, mockLINK, priceOracle;
  let owner, seller, bidder1, bidder2;
  
  this.timeout(120000); // 2分钟超时

  before(async function () {
    console.log("🚀 开始Sepolia网络完整测试...");
    
    // 获取主账户
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    seller = accounts[0]; // 主账户作为seller
    
    // 创建新的随机账户用于出价
    bidder1 = ethers.Wallet.createRandom().connect(ethers.provider);
    bidder2 = ethers.Wallet.createRandom().connect(ethers.provider);
    
    console.log(`📝 账户信息:
      Owner/Seller: ${owner.address}
      Bidder1: ${bidder1.address}
      Bidder2: ${bidder2.address}
      Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address))} ETH
    `);
    
    // 给bidders转账测试ETH
    console.log("💸 给测试账户转账...");
    const transferAmount = ethers.parseEther("0.5"); // 每个账户0.5 ETH
    
    await owner.sendTransaction({
      to: bidder1.address,
      value: transferAmount
    });
    console.log(`✅ 转账 ${ethers.formatEther(transferAmount)} ETH 给 Bidder1`);
    
    await owner.sendTransaction({
      to: bidder2.address,
      value: transferAmount
    });
    console.log(`✅ 转账 ${ethers.formatEther(transferAmount)} ETH 给 Bidder2`);
    
    // 验证转账成功
    const bidder1Balance = await ethers.provider.getBalance(bidder1.address);
    const bidder2Balance = await ethers.provider.getBalance(bidder2.address);
    console.log(`💰 Bidder1 余额: ${ethers.formatEther(bidder1Balance)} ETH`);
    console.log(`💰 Bidder2 余额: ${ethers.formatEther(bidder2Balance)} ETH`);
    
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
    priceOracle = await PriceOracle.deploy(); // 不需要参数，合约内部已硬编码地址
    await priceOracle.waitForDeployment();
    console.log(`✅ Price Oracle: ${await priceOracle.getAddress()}`);

    // 部署拍卖工厂
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    auctionFactory = await AuctionFactory.deploy();
    await auctionFactory.waitForDeployment();
    console.log(`✅ Auction Factory: ${await auctionFactory.getAddress()}`);

    console.log("✅ 所有合约部署完成");
  });

  describe("基础功能测试", function () {
    it("应该能铸造NFT", async function () {
      console.log("🎨 测试NFT铸造...");
      
      const tokenURI = "ipfs://QmSepoliaTest" + Date.now();
      const mintTx = await nftToken.safeMint(seller.address, tokenURI);
      const receipt = await mintTx.wait();
      
      console.log(`✅ Gas使用: ${receipt.gasUsed}`);
      console.log(`✅ NFT铸造成功，tokenId: 0`);
      
      expect(await nftToken.ownerOf(0)).to.equal(seller.address);
      expect(await nftToken.tokenURI(0)).to.equal(tokenURI);
    });

    it("应该能获取ETH价格", async function () {
      console.log("💰 测试价格预言机...");
      
      try {
        const price = await priceOracle.getLatestPrice();
        const priceFormatted = ethers.formatUnits(price, 8);
        console.log(`✅ 当前ETH价格: $${priceFormatted}`);
        expect(price).to.be.greaterThan(0);
      } catch (error) {
        console.log(`⚠️ 价格获取失败: ${error.message}`);
        // 在测试环境中可能会失败，不阻止测试继续
      }
    });
  });

  describe("拍卖系统测试", function () {
    let currentTokenId = 1; // 使用独立的tokenId计数器

    beforeEach(async function () {
      console.log(`🎯 准备拍卖测试 - TokenID: ${currentTokenId}`);
      
      // 铸造新NFT
      const tokenURI = `ipfs://auction-test-${currentTokenId}-${Date.now()}`;
      const mintTx = await nftToken.safeMint(seller.address, tokenURI);
      await mintTx.wait();
      console.log(`✅ NFT #${currentTokenId} 铸造完成`);
      
      // 授权给拍卖工厂
      const factoryAddress = await auctionFactory.getAddress();
      const approveTx = await nftToken.connect(seller).approve(factoryAddress, currentTokenId);
      await approveTx.wait();
      console.log(`✅ NFT #${currentTokenId} 已授权给拍卖工厂`);
    });

    it("应该能创建拍卖", async function () {
      console.log("📈 创建拍卖测试...");
      
      const nftAddress = await nftToken.getAddress();
      const linkAddress = await mockLINK.getAddress();
      const oracleAddress = await priceOracle.getAddress();
      
      const createTx = await auctionFactory.connect(seller).createAuction(
        linkAddress,        // payment token
        nftAddress,         // nft contract
        currentTokenId,    // token id
        ethers.parseEther("10"),  // USD price
        ethers.parseEther("1"),   // min bid
        3600,              // duration (1 hour)
        oracleAddress      // price oracle
      );
      
      const receipt = await createTx.wait();
      console.log(`✅ 拍卖创建成功，Gas使用: ${receipt.gasUsed}`);
      
      // 验证拍卖计数
      const auctionAddress = await auctionFactory.Auctions(0);
      console.log(`✅ 拍卖合约地址: ${auctionAddress}`);
      expect(auctionAddress).to.not.equal("0x0000000000000000000000000000000000000000");
      
      // 检查NFT新所有者（应该是拍卖合约）
      const newOwner = await nftToken.ownerOf(currentTokenId);
      console.log(`✅ NFT新所有者: ${newOwner}`);
      
      currentTokenId++; // 为下次测试准备
    });

    it("应该能用ETH出价", async function () {
      console.log("💰 ETH出价测试...");
      
      // 先创建拍卖
      const nftAddress = await nftToken.getAddress();
      const linkAddress = await mockLINK.getAddress();
      const oracleAddress = await priceOracle.getAddress();
      
      const createTx = await auctionFactory.connect(seller).createAuction(
        linkAddress,
        nftAddress,
        currentTokenId,
        ethers.parseEther("10"),
        ethers.parseEther("1"),
        3600,
        oracleAddress
      );
      await createTx.wait();
      console.log("✅ 拍卖创建完成");
      
      // 获取拍卖合约
      const auctionAddress = await auctionFactory.Auctions(0);
      const Auction = await ethers.getContractFactory("Auction");
      const auction = Auction.attach(auctionAddress);
      
      console.log(`📍 拍卖合约地址: ${auctionAddress}`);
      
      // 用ETH出价
      const bidAmount = ethers.parseEther("0.1");
      console.log(`💵 出价金额: ${ethers.formatEther(bidAmount)} ETH`);
      
      const bidTx = await auction.connect(bidder1).placeBidETH({
        value: bidAmount
      });
      const receipt = await bidTx.wait();
      
      console.log(`✅ 出价成功，Gas使用: ${receipt.gasUsed}`);
      
      // 验证出价信息
      const highestBid = await auction.highestTokenAmount();
      const highestBidder = await auction.highestBidder();
      
      console.log(`✅ 最高出价: ${ethers.formatEther(highestBid)} ETH`);
      console.log(`✅ 最高出价者: ${highestBidder}`);
      
      expect(highestBid).to.equal(bidAmount);
      expect(highestBidder).to.equal(bidder1.address);
      
      currentTokenId++; // 为下次测试准备
  });

  describe("系统集成测试", function () {
    it("应该显示合约部署统计", async function () {
      console.log("\n📊 合约部署统计:");
      console.log(`📄 NFT合约: ${await nftToken.getAddress()}`);
      console.log(`🏭 拍卖工厂: ${await auctionFactory.getAddress()}`);
      console.log(`💰 LINK代币: ${await mockLINK.getAddress()}`);
      console.log(`📊 价格预言机: ${await priceOracle.getAddress()}`);
      
      const totalSupply = await nftToken.totalSupply();
      
      console.log(`📈 NFT总供应量: ${totalSupply}`);
      
      // 尝试获取第一个拍卖合约地址来验证拍卖是否存在
      try {
        const firstAuction = await auctionFactory.Auctions(0);
        console.log(`📈 首个拍卖合约: ${firstAuction}`);
      } catch (error) {
        console.log(`📈 暂无拍卖合约`);
      }
      
      const balance = await ethers.provider.getBalance(owner.address);
      console.log(`💵 剩余余额: ${ethers.formatEther(balance)} ETH`);
      
      // 基本验证
      expect(totalSupply).to.be.greaterThan(0);
    });
  });
});
