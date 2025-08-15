const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 开始资金回收...");
  
  const accounts = await ethers.getSigners();
  const mainAccount = accounts[0];
  
  console.log(`📋 主账户: ${mainAccount.address}`);
  const initialBalance = await ethers.provider.getBalance(mainAccount.address);
  console.log(`💰 主账户当前余额: ${ethers.formatEther(initialBalance)} ETH`);
  
  // 检查其他账户是否有余额可以回收
  for (let i = 1; i < Math.min(accounts.length, 5); i++) {
    const account = accounts[i];
    const balance = await ethers.provider.getBalance(account.address);
    
    console.log(`📋 账户 ${i}: ${account.address}`);
    console.log(`💰 余额: ${ethers.formatEther(balance)} ETH`);
    
    if (balance > ethers.parseEther("0.001")) {
      try {
        // 保留少量gas费用，转回其余部分
        const gasReserve = ethers.parseEther("0.001");
        const transferAmount = balance - gasReserve;
        
        if (transferAmount > 0) {
          console.log(`🔄 从账户 ${i} 回收 ${ethers.formatEther(transferAmount)} ETH...`);
          
          const tx = await account.sendTransaction({
            to: mainAccount.address,
            value: transferAmount,
            gasLimit: 21000
          });
          
          await tx.wait();
          console.log(`✅ 回收成功！`);
        }
      } catch (error) {
        console.log(`❌ 从账户 ${i} 回收失败: ${error.message}`);
      }
    }
  }
  
  const finalBalance = await ethers.provider.getBalance(mainAccount.address);
  console.log(`\n💰 回收后主账户余额: ${ethers.formatEther(finalBalance)} ETH`);
  console.log(`📈 净回收: ${ethers.formatEther(finalBalance - initialBalance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
