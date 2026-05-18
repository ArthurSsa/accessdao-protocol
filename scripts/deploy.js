// scripts/deploy.js
// Script de deploy de todos os contratos na Sepolia Testnet
//
// COMO USAR:
// 1. Configure o .env com PRIVATE_KEY e SEPOLIA_RPC_URL
// 2. Execute: npx hardhat run scripts/deploy.js --network sepolia

const { ethers } = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("  AccessDAO Protocol - Deploy na Sepolia");
  console.log("========================================\n");

  // Pega o deployer (quem paga o gas e é o owner dos contratos)
  const [deployer] = await ethers.getSigners();

  console.log("Deployer (owner):", deployer.address);
  console.log(
    "Saldo:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // =======================
  // 1. DEPLOY: AccessToken (ERC-20)
  // =======================
  console.log("1/4 Deployando AccessToken (ERC-20)...");
  const AccessToken = await ethers.getContractFactory("AccessToken");
  const accessToken = await AccessToken.deploy();
  await accessToken.waitForDeployment();

  const accessTokenAddress = await accessToken.getAddress();
  console.log("   ✅ AccessToken (ACT):", accessTokenAddress);

  // =======================
  // 2. DEPLOY: MembershipNFT (ERC-721)
  // =======================
  console.log("\n2/4 Deployando MembershipNFT (ERC-721)...");
  const MembershipNFT = await ethers.getContractFactory("MembershipNFT");
  const membershipNFT = await MembershipNFT.deploy(accessTokenAddress);
  await membershipNFT.waitForDeployment();

  const membershipNFTAddress = await membershipNFT.getAddress();
  console.log("   ✅ MembershipNFT (ADM):", membershipNFTAddress);

  // =======================
  // 3. DEPLOY: Staking
  // =======================
  // Endereço do Chainlink ETH/USD Price Feed na Sepolia
  // https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1
  const CHAINLINK_ETH_USD_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  console.log("\n3/4 Deployando Staking...");
  console.log("   Oracle Chainlink ETH/USD:", CHAINLINK_ETH_USD_SEPOLIA);

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(accessTokenAddress, CHAINLINK_ETH_USD_SEPOLIA);
  await staking.waitForDeployment();

  const stakingAddress = await staking.getAddress();
  console.log("   ✅ Staking:", stakingAddress);

  // =======================
  // 4. DEPLOY: Governance
  // =======================
  console.log("\n4/4 Deployando Governance (DAO)...");
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await Governance.deploy(membershipNFTAddress);
  await governance.waitForDeployment();

  const governanceAddress = await governance.getAddress();
  console.log("   ✅ Governance:", governanceAddress);

  // =======================
  // CONFIGURAÇÃO PÓS-DEPLOY
  // =======================
  console.log("\n--- Configuração pós-deploy ---");

  // Transferir tokens para o contrato de Staking (para pagar recompensas)
  // Enviamos 1 milhão de ACT como fundo inicial de recompensas
  console.log("Fundando contrato de Staking com 1M ACT...");
  const rewardFund = ethers.parseEther("1000000"); // 1 milhão de ACT
  await accessToken.approve(stakingAddress, rewardFund);
  await staking.fundRewards(rewardFund);
  console.log("✅ Contrato de Staking fundado");

  // =======================
  // RESUMO DO DEPLOY
  // =======================
  console.log("\n========================================");
  console.log("          RESUMO DO DEPLOY              ");
  console.log("========================================");
  console.log("AccessToken (ACT):  ", accessTokenAddress);
  console.log("MembershipNFT (ADM):", membershipNFTAddress);
  console.log("Staking:            ", stakingAddress);
  console.log("Governance:         ", governanceAddress);
  console.log("----------------------------------------");
  console.log("Rede: Sepolia Testnet");
  console.log("Explorer: https://sepolia.etherscan.io");
  console.log("\nLinks dos contratos:");
  console.log(`  ACT:        https://sepolia.etherscan.io/address/${accessTokenAddress}`);
  console.log(`  NFT:        https://sepolia.etherscan.io/address/${membershipNFTAddress}`);
  console.log(`  Staking:    https://sepolia.etherscan.io/address/${stakingAddress}`);
  console.log(`  Governance: https://sepolia.etherscan.io/address/${governanceAddress}`);

  // Salva os endereços em um arquivo JSON para usar no interact.js
  const fs = require("fs");
  const deployedAddresses = {
    network: "sepolia",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AccessToken: accessTokenAddress,
      MembershipNFT: membershipNFTAddress,
      Staking: stakingAddress,
      Governance: governanceAddress,
    },
    chainlink: {
      ETH_USD: CHAINLINK_ETH_USD_SEPOLIA,
    },
  };

  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(deployedAddresses, null, 2)
  );
  console.log("\n✅ Endereços salvos em deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro no deploy:", error);
    process.exit(1);
  });
