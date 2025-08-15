// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockLINK
 * @dev Mock LINK代币，用于测试环境
 * 继承标准ERC20功能，用于模拟LINK代币行为
 */
contract MockLINK is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("ChainLink Token", "LINK") {
        _decimals = 18;
        // 铸造初始供应量给部署者
        _mint(msg.sender, 1000000 * 10**_decimals); // 100万个LINK
    }

    /**
     * @dev 返回代币小数位数
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
     * @dev 批量转账 (便于测试)
     * @param recipients 接收者地址数组
     * @param amounts 对应的金额数组
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }
    }
}
