// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Auction} from "./Auction.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// 创建拍卖工厂合约
contract AuctionFactory is
    IERC721Receiver,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    address[] public Auctions;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // 初始化函数 - 只在部署时调用一次
    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        // 手动设置 owner
        _transferOwnership(msg.sender);
    }

    // 授权升级函数 - 只有owner可以升级合约
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    // 创建拍卖合约函数
    function createAuction(
        address erc20Token,
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 bidIncrement,
        uint256 duration,
        address priceOracle
    ) external returns (address) {
        // 确保ERC20地址
        require(erc20Token != address(0), "Invalid ERC20 address");
        // 确保NFT合约地址
        require(nftContract != address(0), "Invalid NFT contract address");
        // 确保tokenId的所有者是拍卖合约发起者
        require(
            IERC721(nftContract).ownerOf(tokenId) == msg.sender,
            "You are not the owner of this NFT"
        );

        // ✅ 修复：确保NFT已经被授权给工厂合约
        require(
            IERC721(nftContract).getApproved(tokenId) == address(this) ||
                IERC721(nftContract).isApprovedForAll(
                    msg.sender,
                    address(this)
                ),
            "NFT not approved for transfer"
        );

        // 获取NFT所有者地址
        address nftOwner = IERC721(nftContract).ownerOf(tokenId);

        // ✅ 修复：传入NFT合约地址参数
        Auction newAuction = new Auction(
            erc20Token,
            nftOwner,
            nftContract, // ✅ 修复：取消注释
            tokenId,
            startingPrice,
            bidIncrement,
            duration,
            priceOracle
        );

        // ✅ 修复：将NFT转移到拍卖合约中锁定
        IERC721(nftContract).transferFrom(
            msg.sender,
            address(newAuction),
            tokenId
        );

        Auctions.push(address(newAuction));
        return address(newAuction);
    }

    function getAuctions() external view returns (address[] memory) {
        return Auctions;
    }

    // ERC721接受函数
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
