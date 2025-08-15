// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PriceOracle} from "./lib/PriceOracle.sol";

/**
 * @title Auction - 支持CCIP跨链竞拍的NFT拍卖合约
 * @dev 拍卖合约，支持ETH和ERC20代币竞拍，以及跨链竞拍功能
 * 主链：Sepolia测试网
 * 跨链支持：Polygon Amoy测试网
 */
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
    
    // CCIP适配器地址
    address public ccipAdapter;
    
    // 跨链竞拍记录
    struct CrossChainBid {
        address bidder;        // 跨链竞拍者地址
        uint256 amount;        // 竞拍金额(USD)
        uint64 sourceChain;    // 源链选择器
        bool isWinner;         // 是否为获胜者
    }
    
    // 跨链竞拍映射
    mapping(bytes32 => CrossChainBid) public crossChainBids;
    bytes32[] public crossChainBidIds;
    
    // 跨链竞拍状态
    bool public isWinnerCrossChain;
    bytes32 public winningCrossChainBidId;
    
    // 事件定义
    event CrossChainBidReceived(
        bytes32 indexed messageId,
        address indexed bidder,
        uint256 amount,
        uint64 sourceChain
    );
    
    event CrossChainAuctionEnded(
        bytes32 indexed messageId,
        address indexed winner,
        uint256 amount,
        uint64 destinationChain
    );
    
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

    /**
     * @dev 设置CCIP适配器地址 (只有NFT所有者可以设置)
     * @param _ccipAdapter CCIP适配器合约地址
     */
    function setCcipAdapter(address _ccipAdapter) external {
        require(msg.sender == nftOwner, "Only NFT owner can set CCIP adapter");
        require(_ccipAdapter != address(0), "Invalid CCIP adapter address");
        ccipAdapter = _ccipAdapter;
    }

    /**
     * @dev 接收跨链竞拍 (只有CCIP适配器可以调用)
     * @param messageId CCIP消息ID
     * @param bidder 跨链竞拍者地址
     * @param usdAmount 竞拍金额(USD)
     * @param sourceChain 源链选择器
     */
    function receiveCrossChainBid(
        bytes32 messageId,
        address bidder,
        uint256 usdAmount,
        uint64 sourceChain
    ) external {
        require(msg.sender == ccipAdapter, "Only CCIP adapter can call this function");
        require(bidder != address(0), "Invalid bidder address");
        require(usdAmount > 0, "Bid amount must be greater than 0");
        
        // 确保拍卖仍在进行中
        require(
            block.timestamp < startTime + expirationTime,
            "Auction has expired"
        );
        
        // 跨链竞拍者不能是NFT所有者
        require(bidder != nftOwner, "Seller cannot bid");
        
        // 执行通用出价验证
        _validateBid(usdAmount);
        
        // 退还上一个出价者的资金 (如果是本地出价者)
        if (highestBidder != address(0) && !isWinnerCrossChain) {
            _refundPreviousBidder();
        }
        
        // 记录跨链竞拍
        crossChainBids[messageId] = CrossChainBid({
            bidder: bidder,
            amount: usdAmount,
            sourceChain: sourceChain,
            isWinner: false
        });
        crossChainBidIds.push(messageId);
        
        // 更新最高出价信息
        highestBidder = bidder;
        highestUSD = usdAmount;
        highestPaymentToken = address(0); // 标记为跨链竞拍
        highestTokenAmount = 0; // 跨链竞拍没有本地代币数量
        isWinnerCrossChain = true;
        winningCrossChainBidId = messageId;
        
        emit CrossChainBidReceived(messageId, bidder, usdAmount, sourceChain);
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
        
        // 退还上一个出价者的资金 (如果不是跨链竞拍获胜者)
        if (highestBidder != address(0) && !isWinnerCrossChain) {
            _refundPreviousBidder();
        }

        // 重置跨链获胜状态
        if (isWinnerCrossChain) {
            isWinnerCrossChain = false;
            winningCrossChainBidId = bytes32(0);
        }

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
        
        // 退还上一个出价者的资金 (如果不是跨链竞拍获胜者)
        if (highestBidder != address(0) && !isWinnerCrossChain) {
            _refundPreviousBidder();
        }

        // 重置跨链获胜状态
        if (isWinnerCrossChain) {
            isWinnerCrossChain = false;
            winningCrossChainBidId = bytes32(0);
        }

        // 更新最高出价信息
        highestBidder = msg.sender;
        highestUSD = usdValue;
        highestPaymentToken = ERC20_TOKEN;
        highestTokenAmount = _amount;
    }

    /**
     * @dev 结束拍卖函数 - 支持跨链NFT转移
     */
    function endAuction() external {
        // 确保拍卖已经超过过期时间
        require(
            block.timestamp >= startTime + expirationTime,
            "Auction is still ongoing"
        );
        // 只有NFT所有者可以结束拍卖
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
            // 如果获胜者是跨链竞拍者
            if (isWinnerCrossChain) {
                // 标记跨链竞拍为获胜者
                crossChainBids[winningCrossChainBidId].isWinner = true;
                
                // 触发跨链NFT转移事件 (CCIP适配器会监听此事件)
                emit CrossChainAuctionEnded(
                    winningCrossChainBidId,
                    highestBidder,
                    highestUSD,
                    crossChainBids[winningCrossChainBidId].sourceChain
                );
                
                // 注意：跨链情况下，NFT暂时保留在合约中
                // 等待CCIP适配器处理跨链转移
                // 实际的NFT转移将通过 transferNFTToCrossChainWinner 函数完成
            } else {
                // 本地获胜者：直接转移NFT
                IERC721(nftContract).transferFrom(
                    address(this),
                    highestBidder,
                    tokenId
                );
                
                // 将资金转移给NFT所有者
                if (highestPaymentToken == ETH) {
                    (bool success, ) = payable(nftOwner).call{
                        value: highestTokenAmount
                    }("");
                    require(success, "ETH Transfer failed");
                } else if (highestPaymentToken == ERC20_TOKEN) {
                    require(
                        IERC20(ERC20_TOKEN).transfer(nftOwner, highestTokenAmount),
                        "ERC20 Transfer failed"
                    );
                }
            }
        }
    }

    /**
     * @dev 将NFT转移给跨链获胜者 (只有CCIP适配器可以调用)
     * @param winner 获胜者地址
     * @param destinationChain 目标链
     */
    function transferNFTToCrossChainWinner(address winner, uint64 destinationChain) external {
        require(msg.sender == ccipAdapter, "Only CCIP adapter can call this function");
        require(isWinnerCrossChain, "Winner is not cross-chain");
        require(winner == highestBidder, "Invalid winner address");
        
        // 记录目标链信息 (用于日志和验证)
        require(destinationChain > 0, "Invalid destination chain");
        
        // 这里需要与CCIP适配器协调，实现NFT的跨链转移
        // 在实际实现中，可能需要将NFT锁定在合约中，然后在目标链上铸造对应的NFT
        
        // 暂时将NFT转移给CCIP适配器处理
        IERC721(nftContract).transferFrom(address(this), ccipAdapter, tokenId);
    }

    /**
     * @dev 获取跨链竞拍信息
     * @param messageId 消息ID
     * @return bidder 竞拍者地址
     * @return amount 竞拍金额
     * @return sourceChain 源链选择器
     * @return isWinner 是否为获胜者
     */
    function getCrossChainBid(bytes32 messageId) external view returns (
        address bidder,
        uint256 amount,
        uint64 sourceChain,
        bool isWinner
    ) {
        CrossChainBid memory bid = crossChainBids[messageId];
        return (bid.bidder, bid.amount, bid.sourceChain, bid.isWinner);
    }

    /**
     * @dev 获取所有跨链竞拍ID
     * @return 跨链竞拍ID数组
     */
    function getCrossChainBidIds() external view returns (bytes32[] memory) {
        return crossChainBidIds;
    }

    /**
     * @dev 检查是否为跨链获胜者
     * @return 是否为跨链获胜者
     * @return 对应的消息ID
     */
    function getCrossChainWinnerInfo() external view returns (bool, bytes32) {
        return (isWinnerCrossChain, winningCrossChainBidId);
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