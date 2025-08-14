// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceOracle {
    AggregatorV3Interface internal ethUsd;
    AggregatorV3Interface internal linkUsd;

    /**
     * Network:  Arbitrum Sepolia
     * Aggregator: ETH/USD
     * Address: 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
     */
    constructor() {
        ethUsd = AggregatorV3Interface(
            // ETH/USD sopelia 0x694AA1769357215DE4FAC081bf1f309aDC325306
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        );
        linkUsd = AggregatorV3Interface(
            // LINK/USD sopelia 0xc59E3633BAAC79493d908e63626716e204A45EdF
            0xc59E3633BAAC79493d908e63626716e204A45EdF
        );
    }

    // 获取最新的 ETH/USD 价格
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , uint256 updatedAt, ) = ethUsd.latestRoundData();
        require(updatedAt >= block.timestamp - 1 hours, "Data is too old");
        return price;
    }

    // 将 ETH 转换为 USD
    function convertEthToUsd(uint256 ethAmount) public view returns (uint256) {
        int256 ethPrice = getLatestPrice();
        return (ethAmount * uint256(ethPrice)) / 1e8; // 1e8 是 Chainlink 数据的精度
    }

    // 获取最新的 LINK/USD 价格
    function getLatestLinkPrice() public view returns (int256) {
        (, int256 price, , uint256 updatedAt, ) = linkUsd.latestRoundData();
        require(updatedAt >= block.timestamp - 1 hours, "Data is too old");
        return price;
    }

    // 将 LINK 转换为 USD
    function convertLinkToUsd(
        uint256 linkAmount
    ) public view returns (uint256) {
        int256 linkPrice = getLatestLinkPrice();
        return (linkAmount * uint256(linkPrice)) / 1e8; // 1e8 是 Chainlink 数据的精度
    }
}
