// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockLinkToken
 * @dev 模拟LINK代币，用于本地CCIP测试
 * 继承标准ERC20实现
 */
contract MockLinkToken is ERC20 {
    uint8 private _decimals;
    
    /**
     * @dev 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     * @param decimals_ 小数位数
     * @param initialSupply 初始供应量
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @dev 返回代币小数位数
     * @return 小数位数
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev 铸造代币 (仅用于测试)
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev 批量分发代币 (用于测试分发)
     * @param recipients 接收者地址数组
     * @param amounts 对应数量数组
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(transfer(recipients[i], amounts[i]), "Transfer failed");
        }
    }
    
    /**
     * @dev 获取代币基本信息
     * @return name_ 代币名称
     * @return symbol_ 代币符号
     * @return decimals_ 小数位数
     * @return totalSupply_ 总供应量
     */
    function getTokenInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) {
        return (name(), symbol(), decimals(), totalSupply());
    }
}
