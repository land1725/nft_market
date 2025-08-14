// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PriceOracle} from "./lib/PriceOracle.sol";


// 创建拍卖合约
contract Auction is ReentrancyGuard, IERC721Receiver {
    // 定义ETH的地址
    address public constant ETH = address(0);
    // ERC20合约地址
    address public immutable ERC20_TOKEN;
    // NFT合约地址
    address public nftContract;
    // NFT的ID
    uint256 public tokenId;
    // 拍卖的开始时间
    uint256 public startTime = block.timestamp;
    // 拍卖过期时间 30秒
    uint256 public expirationTime;
    // 拍卖的最高出价
    uint256 public highestUSD;
    // 拍卖的最高出价者
    address public highestBidder;
    // 拍卖的最高出价者付款方式ERC20或ETH
    address public highestPaymentToken;
    // 拍卖的最高出价者付出的ERC20或ETH数量
    uint256 public highestTokenAmount;

    // 起拍价格
    uint256 public startingPrice;
    // 每次出价的增幅
    uint256 public bidIncrement;
    // NFT所有者地址
    address public nftOwner;
    
    // 价格预言机合约地址
    address public priceOracle;
    
    // 价格预言机合约地址
    constructor(
        address _erc20Token,
        address _nftOwner,
        address _nftContract,
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _bidIncrement,
        uint256 _duration,
        address _priceOracle
    ) {
        // 校验ERC20地址、NFT所有者地址、NFT合约地址和NFT ID
        require(_erc20Token != address(0), "Invalid ERC20 address");
        ERC20_TOKEN = _erc20Token;
        require(_nftOwner != address(0), "Invalid NFT owner address");
        nftOwner = _nftOwner;
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = _nftContract;
        tokenId = _tokenId;
        require(_startingPrice > 0, "Starting price must be greater than 0");
        startingPrice = _startingPrice;
        require(_bidIncrement > 0, "Bid increment must be greater than 0");
        bidIncrement = _bidIncrement;
        require(_duration > 0, "Duration must be greater than 0");
        // 设置拍卖过期时间
        expirationTime = _duration;
        // 设置价格预言机地址
        require(_priceOracle != address(0), "Invalid price oracle address");
        priceOracle = _priceOracle;
    }

    // 通用出价验证逻辑
    function _validateBid(uint256 usdValue) internal view {
        // 确保地址不是零地址
        require(msg.sender != address(0), "Invalid address");
        // 确保拍卖在指定时间
        require(
            block.timestamp < startTime + expirationTime,
            "Auction has expired"
        );
        // 卖家不能出价
        require(msg.sender != nftOwner, "Seller cannot bid");
        // 确保换算为美元之后的价格大于起拍价格，并且大于最高价+增幅
        uint256 minimumBid = (highestBidder == address(0)) ? startingPrice : highestUSD + bidIncrement;
        require(
            usdValue >= minimumBid,
            "Bid must be higher than starting price and current highest bid"
        );
    }

    // 退还上一个出价者的资金
    function _refundPreviousBidder() internal {
        if (highestBidder != address(0)) {
            if (highestPaymentToken == ERC20_TOKEN) {
                require(
                    IERC20(ERC20_TOKEN).transfer(highestBidder, highestTokenAmount),
                    "ERC20 Transfer failed"
                );
            } else {
                (bool success, ) = payable(highestBidder).call{
                    value: highestTokenAmount
                }("");
                require(success, "ETH Transfer failed");
            }
        }
    }

    // ETH出价函数
    function placeBidETH() external payable nonReentrant {
        // 确保发送了ETH
        require(msg.value > 0, "Must send ETH");

        // 调用价格预言机将ETH换算为美元
        uint256 usdValue = PriceOracle(priceOracle).convertEthToUsd(msg.value);

        // 执行通用验证
        _validateBid(usdValue);
        
        // 退还上一个出价者的资金
        _refundPreviousBidder();

        // 更新最高出价信息
        highestBidder = msg.sender;
        highestUSD = usdValue;
        highestPaymentToken = ETH;
        highestTokenAmount = msg.value;
    }

    // ERC20出价函数
    function placeBidERC20(uint256 _amount) external nonReentrant {
        // 确保金额大于0
        require(_amount > 0, "Amount must be greater than 0");
        
        // 将ERC20(LINK)换算为美元
        uint256 usdValue = PriceOracle(priceOracle).convertLinkToUsd(_amount);
        
        // 执行通用验证
        _validateBid(usdValue);
        
        // 转移ERC20到拍卖合约
        require(
            IERC20(ERC20_TOKEN).transferFrom(msg.sender, address(this), _amount),
            "ERC20 transfer failed"
        );
        
        // 退还上一个出价者的资金
        _refundPreviousBidder();

        // 更新最高出价信息
        highestBidder = msg.sender;
        highestUSD = usdValue;
        highestPaymentToken = ERC20_TOKEN;
        highestTokenAmount = _amount;
    }

    // 结束拍卖函数
    function endAuction() external {
        // 确保拍卖已经超过过期时间
        require(
            block.timestamp >= startTime + expirationTime,
            "Auction is still ongoing"
        );
        // ✅ 修复：只有NFT所有者可以结束拍卖
        require(
            msg.sender == nftOwner,
            "Only owner can end the auction"
        );
        // 如果没有出价者，将NFT返回给所有者
        if (highestBidder == address(0)) {
            IERC721(nftContract).transferFrom(
                address(this),
                nftOwner,
                tokenId
            );
        } else {
            // 将NFT转移给最高出价者
            IERC721(nftContract).transferFrom(
                address(this),
                highestBidder,
                tokenId
            );
            // ✅ 修复：将资金转移给NFT所有者，而不是最高出价者
            if (highestPaymentToken == ETH) {
                (bool success, ) = payable(nftOwner).call{
                    value: highestTokenAmount  // ✅ 修复：使用实际ETH数量
                }("");
                require(success, "ETH Transfer failed");
            }
            // 如果最高出价者是ERC20，转移ERC20到NFT所有者
            else {
                require(
                    IERC20(ERC20_TOKEN).transfer(nftOwner, highestTokenAmount),
                    "ERC20 Transfer failed"
                );
            }
        }
    }

    // 查询ETH出价需要的最低数量
    function getMinimumBidAmountETH() external view returns (uint256) {
        uint256 minimumBidUSD;
        // 如果拍卖未开始（没有出价者），返回起拍价格
        if (highestBidder == address(0)) {
            minimumBidUSD = startingPrice;
        } else {
            // 如果已有出价者，返回当前最高价加上最小加价幅度
            minimumBidUSD = highestUSD + bidIncrement;
        }
        
        // 将美元转换为ETH（wei）
        int256 ethPrice = PriceOracle(priceOracle).getLatestPrice();
        require(ethPrice > 0, "Invalid ETH price");
        
        // 计算需要的ETH数量（以wei为单位）
        // minimumBidUSD 是美元数量（整数）
        // ethPrice 是美元价格（8位精度）
        // 结果应该是 wei（18位精度）
        uint256 requiredETH = (minimumBidUSD * 1e18 * 1e8) / uint256(ethPrice);
        
        // 确保至少返回1 wei
        return requiredETH > 0 ? requiredETH : 1;
    }

    // 查询ERC20出价需要的最低数量
    function getMinimumBidAmountERC20() external view returns (uint256) {
        uint256 minimumBidUSD;
        // 如果拍卖未开始（没有出价者），返回起拍价格
        if (highestBidder == address(0)) {
            minimumBidUSD = startingPrice;
        } else {
            // 如果已有出价者，返回当前最高价加上最小加价幅度
            minimumBidUSD = highestUSD + bidIncrement;
        }
        
        // 将美元转换为ERC20(LINK)数量
        int256 linkPrice = PriceOracle(priceOracle).getLatestLinkPrice();
        require(linkPrice > 0, "Invalid LINK price");
        
        // 计算需要的LINK数量（以最小单位为准，18位精度）
        // minimumBidUSD 是美元数量（整数）
        // linkPrice 是美元价格（8位精度）
        // 结果应该是 LINK 最小单位（18位精度）
        uint256 requiredLINK = (minimumBidUSD * 1e18 * 1e8) / uint256(linkPrice);
        
        // 确保至少返回1个最小单位
        return requiredLINK > 0 ? requiredLINK : 1;
    }

    // 调试函数：查看当前汇率
    function getTokenRates() external view returns (uint256 ethRate, uint256 erc20Rate) {
        int256 ethPrice = PriceOracle(priceOracle).getLatestPrice();
        int256 linkPrice = PriceOracle(priceOracle).getLatestLinkPrice();
        return (uint256(ethPrice), uint256(linkPrice));
    }


    // 调试函数：查看拍卖状态
    function getAuctionStatus() external view returns (
        uint256 _startTime,
        uint256 _expirationTime,
        uint256 _startingPrice,
        uint256 _bidIncrement,
        uint256 _highestUSD,
        address _highestBidder
    ) {
        return (
            startTime,
            expirationTime,
            startingPrice,
            bidIncrement,
            highestUSD,
            highestBidder
        );
    }

    /**
     * @dev 实现IERC721Receiver接口，允许合约接收NFT
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}