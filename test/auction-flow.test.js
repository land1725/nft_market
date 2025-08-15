const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction Flow Tests", function () {
  let auctionFactory, nftToken, mockLINK, priceOracle, auction;
  let owner, seller, bidder1, bidder2, bidder3;
  let tokenId = 0;

  before(async function () {
    [owner, seller, bidder1, bidder2, bidder3] = await ethers.getSigners();
    
    console.log("🔧 部署测试合约...");

    // 部署MockLINK代币
    const MockLINK = await ethers.getContractFactory("MockLINK");
    mockLINK = await MockLINK.deploy();
    await mockLINK.waitForDeployment();

    // 部署NFT合约
    const NftToken = await ethers.getContractFactory("NftToken");
    nftToken = await NftToken.deploy(owner.address);
    await nftToken.waitForDeployment();

    // 部署价格预言机
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();

    // 部署拍卖工厂
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    auctionFactory = await AuctionFactory.deploy();
    await auctionFactory.waitForDeployment();

    console.log("✅ 所有合约部署完成");
  });

  beforeEach(async function () {
    // 铸造NFT给seller
    await nftToken.safeMint(seller.address, `ipfs://test${tokenId}`);
    
    // seller授权NFT给拍卖工厂
    await nftToken.connect(seller).approve(await auctionFactory.getAddress(), tokenId);
    
    // 为bidders分发LINK代币
    await mockLINK.transfer(bidder1.address, ethers.parseEther("1000"));
    await mockLINK.transfer(bidder2.address, ethers.parseEther("1000"));
    
    tokenId++; // 为下次测试准备新的tokenId
  });

  describe("创建拍卖", function () {
    it("应该能创建新拍卖", async function () {
      const tx = await auctionFactory.connect(seller).createAuction(
        await mockLINK.getAddress(),
        await nftToken.getAddress(),
        0,
        ethers.parseEther("10"), // 10 USD起拍价
        ethers.parseEther("1"),  // 1 USD加价幅度
        3600, // 1小时
        await priceOracle.getAddress()
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const auctions = await auctionFactory.getAuctions();
      expect(auctions.length).to.equal(1);
    });

    it("创建拍卖后NFT应该被转移", async function () {
      await auctionFactory.connect(seller).createAuction(
        await mockLINK.getAddress(),
        await nftToken.getAddress(),
        0,
        ethers.parseEther("10"),
        ethers.parseEther("1"),
        3600,
        await priceOracle.getAddress()
      );

      const auctions = await auctionFactory.getAuctions();
      const auctionAddress = auctions[0];
      
      expect(await nftToken.ownerOf(0)).to.equal(auctionAddress);
    });
  });

  describe("拍卖出价", function () {
    beforeEach(async function () {
      // 创建拍卖
      await auctionFactory.connect(seller).createAuction(
        await mockLINK.getAddress(),
        await nftToken.getAddress(),
        0,
        ethers.parseEther("10"),
        ethers.parseEther("1"),
        3600,
        await priceOracle.getAddress()
      );

      const auctions = await auctionFactory.getAuctions();
      auction = await ethers.getContractAt("Auction", auctions[0]);
    });

    it("应该能用ETH出价", async function () {
      const minETH = await auction.getMinimumBidAmountETH();
      
      await auction.connect(bidder1).placeBidETH({ value: minETH });
      
      const status = await auction.getAuctionStatus();
      expect(status[4]).to.be.greaterThan(0); // highest bid
      expect(status[5]).to.equal(bidder1.address); // highest bidder
    });

    it("应该能用LINK出价", async function () {
      const minLINK = await auction.getMinimumBidAmountERC20();
      
      // 授权LINK
      await mockLINK.connect(bidder1).approve(await auction.getAddress(), minLINK);
      
      await auction.connect(bidder1).placeBidERC20(minLINK);
      
      const status = await auction.getAuctionStatus();
      expect(status[4]).to.be.greaterThan(0);
      expect(status[5]).to.equal(bidder1.address);
    });

    it("多次出价应该更新最高出价", async function () {
      const minETH1 = await auction.getMinimumBidAmountETH();
      await auction.connect(bidder1).placeBidETH({ value: minETH1 });
      
      const minETH2 = await auction.getMinimumBidAmountETH();
      await auction.connect(bidder2).placeBidETH({ value: minETH2 });
      
      const status = await auction.getAuctionStatus();
      expect(status[5]).to.equal(bidder2.address);
    });
  });

  describe("拍卖结束", function () {
    beforeEach(async function () {
      await auctionFactory.connect(seller).createAuction(
        await mockLINK.getAddress(),
        await nftToken.getAddress(),
        0,
        ethers.parseEther("10"),
        ethers.parseEther("1"),
        3600,
        await priceOracle.getAddress()
      );

      const auctions = await auctionFactory.getAuctions();
      auction = await ethers.getContractAt("Auction", auctions[0]);
    });

    it("有出价时结束拍卖应该转移NFT", async function () {
      const minETH = await auction.getMinimumBidAmountETH();
      await auction.connect(bidder1).placeBidETH({ value: minETH });
      
      await time.increase(3601); // 超过拍卖时间
      await auction.connect(seller).endAuction();
      
      expect(await nftToken.ownerOf(0)).to.equal(bidder1.address);
    });

    it("无出价时结束拍卖应该返还NFT给卖家", async function () {
      await time.increase(3601);
      await auction.connect(seller).endAuction();
      
      expect(await nftToken.ownerOf(0)).to.equal(seller.address);
    });
  });
});