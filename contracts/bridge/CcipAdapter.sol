// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// 简化的Mock CCIP路由器接口
interface IMockCCIPRouter {
    function getFee(uint64 destinationChainSelector, bytes memory message) external view returns (uint256);
    function ccipSend(uint64 destinationChainSelector, bytes memory message) external returns (bytes32);
}

/**
 * @title CcipAdapter
 * @dev 简化的跨链通信适配器，用于本地测试
 * 支持跨链竞拍功能
 */
contract CcipAdapter is Ownable {
    // Mock CCIP路由器地址
    address public immutable router;
    // LINK代币地址
    address public immutable linkToken;
    // 拍卖合约地址
    address public auctionContract;
    
    // 跨链消息类型枚举
    enum MessageType {
        CROSS_CHAIN_BID,
        NFT_TRANSFER
    }
    
    // 允许的源链
    mapping(uint64 => bool) public allowlistedSourceChains;
    // 允许的目标链
    mapping(uint64 => bool) public allowlistedDestinationChains;
    // 允许的发送者
    mapping(address => bool) public allowlistedSenders;
    
    // 事件定义
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        bytes data,
        uint256 fees
    );
    
    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address sender,
        bytes data
    );
    
    event CrossChainBidSent(
        uint64 indexed destinationChainSelector,
        address indexed bidder,
        uint256 amount
    );
    
    event CrossChainBidReceived(
        bytes32 indexed messageId,
        address indexed bidder,
        uint256 amount,
        uint64 sourceChainSelector
    );
    
    constructor(address _router, address _linkToken) Ownable(msg.sender) {
        require(_router != address(0), "Router cannot be zero address");
        require(_linkToken != address(0), "LINK token cannot be zero address");
        
        router = _router;
        linkToken = _linkToken;
    }
    
    // 修饰器：仅允许列表中的源链
    modifier onlyAllowlistedSourceChain(uint64 _sourceChainSelector) {
        require(
            allowlistedSourceChains[_sourceChainSelector],
            "Source chain not allowlisted"
        );
        _;
    }
    
    // 修饰器：仅允许列表中的目标链
    modifier onlyAllowlistedDestinationChain(uint64 _destinationChainSelector) {
        require(
            allowlistedDestinationChains[_destinationChainSelector],
            "Destination chain not allowlisted"
        );
        _;
    }
    
    // 修饰器：仅允许列表中的发送者
    modifier onlyAllowlistedSender(address _sender) {
        require(allowlistedSenders[_sender], "Sender not allowlisted");
        _;
    }
    
    /**
     * @dev 设置拍卖合约地址
     * @param _auctionContract 拍卖合约地址
     */
    function setAuctionContract(address _auctionContract) external onlyOwner {
        require(_auctionContract != address(0), "Auction contract cannot be zero address");
        auctionContract = _auctionContract;
    }
    
    /**
     * @dev 管理允许的源链
     * @param _sourceChainSelector 源链选择器
     * @param allowed 是否允许
     */
    function allowlistSourceChain(uint64 _sourceChainSelector, bool allowed) external onlyOwner {
        allowlistedSourceChains[_sourceChainSelector] = allowed;
    }
    
    /**
     * @dev 管理允许的目标链
     * @param _destinationChainSelector 目标链选择器
     * @param allowed 是否允许
     */
    function allowlistDestinationChain(uint64 _destinationChainSelector, bool allowed) external onlyOwner {
        allowlistedDestinationChains[_destinationChainSelector] = allowed;
    }
    
    /**
     * @dev 管理允许的发送者
     * @param _sender 发送者地址
     * @param allowed 是否允许
     */
    function allowlistSender(address _sender, bool allowed) external onlyOwner {
        allowlistedSenders[_sender] = allowed;
    }
    
    /**
     * @dev 发送跨链竞拍
     * @param destinationChainSelector 目标链选择器
     * @param receiver 接收合约地址
     * @param bidder 竞拍者地址
     * @param bidAmount 竞拍金额 (USD)
     * @return messageId 消息ID
     */
    function sendCrossChainBid(
        uint64 destinationChainSelector,
        address receiver,
        address bidder,
        uint256 bidAmount
    ) external onlyAllowlistedDestinationChain(destinationChainSelector) returns (bytes32 messageId) {
        // 编码消息数据
        bytes memory messageData = abi.encode(
            MessageType.CROSS_CHAIN_BID,
            bidder,
            bidAmount,
            block.timestamp
        );
        
        // 构建完整消息
        bytes memory message = abi.encode(receiver, messageData);
        
        // 计算费用
        IMockCCIPRouter mockRouter = IMockCCIPRouter(router);
        uint256 fees = mockRouter.getFee(destinationChainSelector, message);
        
        // 从发送者收取LINK费用
        IERC20(linkToken).transferFrom(msg.sender, address(this), fees);
        
        // 授权路由器使用LINK
        IERC20(linkToken).approve(router, fees);
        
        // 发送消息
        messageId = mockRouter.ccipSend(destinationChainSelector, message);
        
        emit MessageSent(messageId, destinationChainSelector, receiver, messageData, fees);
        emit CrossChainBidSent(destinationChainSelector, bidder, bidAmount);
        
        return messageId;
    }
    
    /**
     * @dev 接收CCIP消息 (由Mock路由器调用)
     * @param messageId 消息ID
     * @param sourceChainSelector 源链选择器
     * @param sender 发送者地址
     * @param data 消息数据
     */
    function ccipReceive(
        bytes32 messageId,
        uint64 sourceChainSelector,
        address sender,
        bytes calldata data
    ) external onlyAllowlistedSourceChain(sourceChainSelector) {
        require(msg.sender == router, "Only router can call");
        
        emit MessageReceived(messageId, sourceChainSelector, sender, data);
        
        // 解码消息
        (MessageType messageType, address bidder, uint256 bidAmount, /* uint256 timestamp */) = 
            abi.decode(data, (MessageType, address, uint256, uint256));
        
        if (messageType == MessageType.CROSS_CHAIN_BID) {
            _processCrossChainBid(messageId, sourceChainSelector, bidder, bidAmount);
        }
        // 可以添加其他消息类型的处理
    }
    
    /**
     * @dev 处理跨链竞拍
     * @param messageId 消息ID
     * @param sourceChainSelector 源链选择器
     * @param bidder 竞拍者地址
     * @param bidAmount 竞拍金额
     */
    function _processCrossChainBid(
        bytes32 messageId,
        uint64 sourceChainSelector,
        address bidder,
        uint256 bidAmount
    ) internal {
        require(auctionContract != address(0), "Auction contract not set");
        
        emit CrossChainBidReceived(messageId, bidder, bidAmount, sourceChainSelector);
        
        // 调用拍卖合约的接收跨链竞拍函数
        (bool success, ) = auctionContract.call(
            abi.encodeWithSignature(
                "receiveCrossChainBid(bytes32,address,uint256,uint64)",
                messageId,
                bidder,
                bidAmount,
                sourceChainSelector
            )
        );
        
        require(success, "Failed to process cross-chain bid");
    }
    
    /**
     * @dev 获取CCIP费用
     * @param destinationChainSelector 目标链选择器
     * @param messageData 消息数据
     * @return 费用金额
     */
    function getCCIPFee(
        uint64 destinationChainSelector,
        bytes memory messageData
    ) external view returns (uint256) {
        bytes memory message = abi.encode(address(this), messageData);
        return IMockCCIPRouter(router).getFee(destinationChainSelector, message);
    }
    
    /**
     * @dev 提取LINK代币
     * @param to 接收地址
     * @param amount 提取数量
     */
    function withdrawLink(address to, uint256 amount) external onlyOwner {
        require(IERC20(linkToken).transfer(to, amount), "Transfer failed");
    }
    
    /**
     * @dev 获取LINK余额
     * @return LINK余额
     */
    function getLinkBalance() external view returns (uint256) {
        return IERC20(linkToken).balanceOf(address(this));
    }
}
