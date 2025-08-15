const { run } = require("hardhat");

const verify = async (contractAddress, args) => {
  console.log("正在验证合约...");
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
    console.log("✅ 合约验证成功");
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("✅ 合约已经验证过了");
    } else {
      console.log("❌ 验证失败:", e);
    }
  }
};

module.exports = { verify };
