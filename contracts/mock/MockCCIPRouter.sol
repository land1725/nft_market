// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockCCIPRouter
 * @dev Mock CCIP路由器，用于本地测试
 * 模拟Chainlink CCIP Router的基本功能
 */
contract MockCCIPRouter {
    // LINK代币地址
    IERC20 public immutable linkToken;
    
    // 模拟费用 (固定为0.01 LINK)
    uint256 public constant MOCK_FEE = 0.01 ether;
    
    // 事件定义
    event CCIPMessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed sender,
        bytes data,
        uint256 fees
    );
    
    event CCIPMessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address indexed receiver,
        bytes data
    );
    
    // 消息结构体
    struct Message {
        bytes32 messageId;
        uint64 sourceChainSelector;
        address sender;
        address receiver;
        bytes data;
        bool processed;
    }
    
    // 存储已发送的消息
    mapping(bytes32 => Message) public messages;
    bytes32[] public messageIds;
    
    // 消息计数器，用于生成唯一ID
    uint256 private messageCounter;
    
    constructor(address _linkToken) {
        linkToken = IERC20(_linkToken);
    }
    
    /**
     * @dev 计算跨链消息费用 (模拟函数)
     * @param destinationChainSelector 目标链选择器
     * @param message 消息内容 (实际中包含更多参数)
     * @return 费用金额
     */
    function getFee(
        uint64 destinationChainSelector,
        bytes memory message
    ) external pure returns (uint256) {
        // 避免未使用参数警告
        destinationChainSelector;
        message;
        
        // 返回固定费用
        return MOCK_FEE;
    }
    
    /**
     * @dev 发送跨链消息 (模拟函数)
     * @param destinationChainSelector 目标链选择器
     * @param message 消息内容
     * @return messageId 消息ID
     */
    function ccipSend(
        uint64 destinationChainSelector,
        bytes memory message
    ) external returns (bytes32 messageId) {
        // 收取LINK费用
        require(
            linkToken.transferFrom(msg.sender, address(this), MOCK_FEE),
            "Failed to pay CCIP fee"
        );
        
        // 生成消息ID
        messageCounter++;
        messageId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            messageCounter,
            destinationChainSelector
        ));
        
        // 解码消息以获取接收者和数据
        (address receiver, bytes memory data) = abi.decode(message, (address, bytes));
        
        // 存储消息
        messages[messageId] = Message({
            messageId: messageId,
            sourceChainSelector: getCurrentChainSelector(),
            sender: msg.sender,
            receiver: receiver,
            data: data,
            processed: false
        });
        messageIds.push(messageId);
        
        emit CCIPMessageSent(
            messageId,
            destinationChainSelector,
            msg.sender,
            data,
            MOCK_FEE
        );
        
        // 在本地测试中，立即处理消息
        _processMessage(messageId);
        
        return messageId;
    }
    
    /**
     * @dev 处理消息 (模拟CCIP网络处理)
     * @param messageId 消息ID
     */
    function _processMessage(bytes32 messageId) internal {
        Message storage message = messages[messageId];
        require(!message.processed, "Message already processed");
        
        message.processed = true;
        
        // 调用接收合约的ccipReceive函数
        try ICCIPReceiver(message.receiver).ccipReceive(
            messageId,
            message.sourceChainSelector,
            message.sender,
            message.data
        ) {
            emit CCIPMessageReceived(
                messageId,
                message.sourceChainSelector,
                message.receiver,
                message.data
            );
        } catch Error(string memory reason) {
            // 处理失败，重置状态
            message.processed = false;
            revert(string(abi.encodePacked("CCIP receive failed: ", reason)));
        }
    }
    
    /**
     * @dev 手动处理消息 (用于测试)
     * @param messageId 消息ID
     */
    function manualProcessMessage(bytes32 messageId) external {
        _processMessage(messageId);
    }
    
    /**
     * @dev 获取当前链选择器 (模拟)
     * @return 链选择器
     */
    function getCurrentChainSelector() public view returns (uint64) {
        // 根据chainId返回模拟的链选择器
        if (block.chainid == 1) {
            return 5009297550715157269; // Ethereum Mainnet
        } else if (block.chainid == 137) {
            return 4051577828743386545; // Polygon Mainnet
        } else {
            return 16015286601757825753; // 默认Sepolia
        }
    }
    
    /**
     * @dev 获取消息详情
     * @param messageId 消息ID
     * @return sourceChainSelector 源链选择器
     * @return sender 发送者地址
     * @return receiver 接收者地址
     * @return data 消息数据
     * @return processed 是否已处理
     */
    function getMessage(bytes32 messageId) external view returns (
        uint64 sourceChainSelector,
        address sender,
        address receiver,
        bytes memory data,
        bool processed
    ) {
        Message memory message = messages[messageId];
        return (
            message.sourceChainSelector,
            message.sender,
            message.receiver,
            message.data,
            message.processed
        );
    }
    
    /**
     * @dev 获取所有消息ID
     * @return 消息ID数组
     */
    function getAllMessageIds() external view returns (bytes32[] memory) {
        return messageIds;
    }
    
    /**
     * @dev 获取路由器中的LINK余额
     * @return LINK余额
     */
    function getLinkBalance() external view returns (uint256) {
        return linkToken.balanceOf(address(this));
    }
    
    /**
     * @dev 提取LINK代币 (仅用于测试)
     * @param to 接收地址
     * @param amount 提取数量
     */
    function withdrawLink(address to, uint256 amount) external {
        require(linkToken.transfer(to, amount), "Transfer failed");
    }
}

/**
 * @dev 简化的CCIP接收者接口
 */
interface ICCIPReceiver {
    function ccipReceive(
        bytes32 messageId,
        uint64 sourceChainSelector,
        address sender,
        bytes calldata data
    ) external;
}
