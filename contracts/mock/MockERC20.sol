// 创建模拟 LINK 合约
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockLINK is ERC20, Ownable {
    constructor() ERC20("Mock LINK", "LINK") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
    
    // 允许任何人铸造代币用于测试
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    // 水龙头功能 - 任何人都可以获得一些测试代币
    function faucet(uint256 amount) public {
        require(amount <= 10000 * 10 ** decimals(), "Amount too large");
        _mint(msg.sender, amount);
    }
    
    // 获取标准数量的测试代币
    function getTestTokens() public {
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}
