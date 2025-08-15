# CCIP跨链竞拍功能

本项目实现了基于Chainlink CCIP的跨链NFT拍卖系统，支持从Polygon Amoy测试网向Sepolia网络的拍卖合约进行跨链竞拍。

## 🏗️ 架构设计

### 主要组件

1. **Auction.sol** (Sepolia网络)
   - 主拍卖合约，支持ETH、ERC20和跨链竞拍
   - 集成CCIP适配器接收跨链竞拍
   - 支持跨链NFT转移

2. **CcipAdapter.sol** (两个网络都部署)
   - CCIP消息发送和接收
   - 跨链竞拍消息路由
   - NFT跨链转移协调

### 网络配置

- **主链**: Sepolia测试网 (拍卖合约部署)
- **跨链**: Polygon Amoy测试网 (用户发起跨链竞拍)

## 🚀 部署步骤

### 1. 环境配置

在 `.env` 文件中配置：

```env
# RPC URLs
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
POLYGON_AMOY_RPC_URL="https://rpc-amoy.polygon.technology"

# 私钥
PRIVATE_KEY="your_private_key"

# API Keys
ETHERSCAN_API_KEY="your_etherscan_api_key"
POLYGONSCAN_API_KEY="your_polygonscan_api_key"
```

### 2. 安装依赖

```bash
npm install @chainlink/contracts-ccip
```

### 3. 部署合约

#### 在Sepolia网络部署基础合约：

```bash
# 部署基础合约
npx hardhat deploy --network sepolia --tags "mocks,oracle,nft,factory"

# 部署CCIP适配器
npx hardhat deploy --network sepolia --tags "ccip"
```

#### 在Polygon Amoy网络部署CCIP适配器：

```bash
npx hardhat deploy --network polygonAmoy --tags "ccip"
```

### 4. 配置CCIP适配器

部署完成后，需要配置CCIP适配器的权限和地址：

```javascript
// 在Sepolia上的拍卖合约设置CCIP适配器
await auctionContract.setCcipAdapter(SEPOLIA_CCIP_ADAPTER_ADDRESS);

// 在两个网络上相互允许对方的CCIP适配器
await ccipAdapter.allowlistSender(OTHER_CHAIN_ADAPTER_ADDRESS, true);
```

## 🎯 使用流程

### 1. 创建拍卖 (Sepolia网络)

```bash
npx hardhat run scripts/create-auction.js --network sepolia
```

### 2. 跨链竞拍 (Polygon Amoy网络)

```bash
# 修改scripts/cross-chain-bid.js中的合约地址
npx hardhat run scripts/cross-chain-bid.js --network polygonAmoy
```

### 3. 检查竞拍状态 (Sepolia网络)

```bash
npx hardhat run scripts/check-cross-chain-status.js --network sepolia
```

### 4. 结束拍卖

```bash
# 如果跨链用户获胜，NFT会自动通过CCIP转移
npx hardhat run scripts/end-auction.js --network sepolia
```

## 🔧 核心功能

### 跨链竞拍流程

1. **发起竞拍** (Polygon Amoy)
   - 用户调用 `CcipAdapter.sendCrossChainBid()`
   - CCIP消息发送到Sepolia网络

2. **处理竞拍** (Sepolia)
   - CCIP适配器接收消息
   - 调用拍卖合约的 `receiveCrossChainBid()`
   - 更新最高出价

3. **结束拍卖** (Sepolia)
   - 如果跨链用户获胜，触发 `CrossChainAuctionEnded` 事件
   - CCIP适配器监听事件，准备NFT跨链转移

4. **NFT跨链转移** (Sepolia → Polygon Amoy)
   - 通过CCIP发送NFT转移消息
   - 在目标链上处理NFT接收

### 支持的竞拍类型

1. **本地ETH竞拍** (`placeBidETH()`)
2. **本地ERC20竞拍** (`placeBidERC20()`)
3. **跨链竞拍** (`receiveCrossChainBid()`)

### 安全特性

- ✅ 重入攻击保护
- ✅ 权限控制 (只有CCIP适配器可以处理跨链竞拍)
- ✅ 链和发送者白名单
- ✅ 竞拍验证 (时间、金额、身份)

## 📊 Gas费用

### CCIP跨链消息费用

- 竞拍消息: ~0.001 LINK
- NFT转移消息: ~0.002 LINK

### 合约交互费用

- 发送跨链竞拍: ~200,000 gas
- 接收跨链竞拍: ~150,000 gas
- 结束拍卖: ~100,000 gas

## 🛠️ 开发工具

### 测试脚本

```bash
# 跨链竞拍测试
npx hardhat test test/cross-chain-auction.test.js --network sepolia

# 本地CCIP测试 (需要ccip-local)
npx hardhat test test/ccip-local.test.js --network localhost
```

### 调试工具

```bash
# 检查CCIP消息状态
npx hardhat run scripts/check-ccip-message.js --network sepolia

# 查看拍卖详情
npx hardhat run scripts/auction-details.js --network sepolia
```

## 🔍 事件监听

### 重要事件

```solidity
// 跨链竞拍接收
event CrossChainBidReceived(
    bytes32 indexed messageId,
    address indexed bidder,
    uint256 amount,
    uint64 sourceChain
);

// 跨链拍卖结束
event CrossChainAuctionEnded(
    bytes32 indexed messageId,
    address indexed winner,
    uint256 amount,
    uint64 destinationChain
);

// CCIP消息发送
event MessageSent(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    address receiver,
    address bidder,
    uint256 bidAmount,
    address feeToken,
    uint256 fees
);
```

## 📋 链选择器

- **Sepolia**: `16015286601757825753`
- **Polygon Amoy**: `16281711391670634445`

## 🎛️ 合约地址

### CCIP基础设施

#### Sepolia
- CCIP Router: `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59`
- LINK Token: `0x779877A7B0D9E8603169DdbD7836e478b4624789`

#### Polygon Amoy
- CCIP Router: `0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2`
- LINK Token: `0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904`

## 🔗 相关链接

- [Chainlink CCIP文档](https://docs.chain.link/ccip)
- [CCIP支持的网络](https://docs.chain.link/ccip/supported-networks)
- [Sepolia测试网](https://sepolia.etherscan.io/)
- [Polygon Amoy测试网](https://amoy.polygonscan.com/)

## ⚠️ 注意事项

1. **测试网络**: 仅在测试网络使用，不适用于主网
2. **LINK余额**: 确保CCIP适配器有足够的LINK支付跨链费用
3. **确认时间**: 跨链消息可能需要几分钟到几十分钟确认
4. **Gas限制**: 跨链消息的gas限制已预设，复杂操作可能需要调整
5. **网络稳定性**: 测试网络可能不稳定，建议多次尝试
