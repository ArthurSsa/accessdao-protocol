// scripts/interact.js
// Demonstração completa do protocolo AccessDAO:
// - Mint de NFT (membership)
// - Stake de tokens ACT
// - Votação na DAO
//
// COMO USAR:
// 1. Faça o deploy primeiro: npx hardhat run scripts/deploy.js --network sepolia
// 2. Execute: npx hardhat run scripts/interact.js --network sepolia

const { ethers } = require("hardhat");
const fs = require("fs");

function loadAddresses() {
  if (!fs.existsSync("deployed-addresses.json")) {
    throw new Error("Arquivo deployed-addresses.json não encontrado.");
  }
  return JSON.parse(fs.readFileSync("deployed-addresses.json", "utf8"));
}

function formatACT(amount) {
  return ethers.formatEther(amount) + " ACT";
}

async function main() {
  console.log("========================================");
  console.log("  AccessDAO - Demonstração Interativa  ");
  console.log("========================================\n");

  const { contracts } = loadAddresses();
  const [deployer] = await ethers.getSigners();

  const accessToken = await ethers.getContractAt("AccessToken", contracts.AccessToken);
  const membershipNFT = await ethers.getContractAt("MembershipNFT", contracts.MembershipNFT);
  const staking = await ethers.getContractAt("Staking", contracts.Staking);
  const governance = await ethers.getContractAt("Governance", contracts.Governance);

  console.log("Carteira:", deployer.address);
  console.log("Saldo ACT:", formatACT(await accessToken.balanceOf(deployer.address)));

  // =======================
  // ETAPA 1: Mint de NFT Silver
  // =======================
  console.log("\n--- ETAPA 1: Mint de Membership NFT ---");

  const jaMembro = await membershipNFT.hasMembership(deployer.address);
  if (!jaMembro) {
    console.log("Aprovando 500 ACT para o contrato NFT...");
    await accessToken.approve(contracts.MembershipNFT, ethers.parseEther("500"));
    console.log("Mintando membership Silver...");
    const mintTx = await membershipNFT.mintMembership(1); // 1 = SILVER
    const receipt = await mintTx.wait();
    const mintEvent = receipt.logs.find(l => l.fragment && l.fragment.name === "MembershipMinted");
    console.log(`✅ NFT #${mintEvent.args[1]} mintado (SILVER) - Poder de voto: 3`);
  } else {
    const tokenId = await membershipNFT.membershipTokenId(deployer.address);
    const tier = await membershipNFT.tokenTier(tokenId);
    const tierNomes = ["BRONZE", "SILVER", "GOLD"];
    const poderes = [1, 3, 10];
    console.log(`✅ Já possui membership NFT #${tokenId} (${tierNomes[tier]}) - Poder de voto: ${poderes[tier]}`);
  }

  // =======================
  // ETAPA 2: Staking de Tokens ACT
  // =======================
  console.log("\n--- ETAPA 2: Staking de Tokens ACT ---");

  const ethPrice = await staking.getETHPrice();
  const rate = await staking.getAdjustedRewardRate();
  console.log(`Preço ETH/USD: $${(Number(ethPrice) / 1e8).toFixed(2)}`);
  console.log(`Taxa de recompensa: ${Number(rate) / 100}% ao ano`);

  const stakeInfo = await staking.stakes(deployer.address);
  if (stakeInfo.amount > 0n) {
    console.log(`\n✅ Já possui ${formatACT(stakeInfo.amount)} em stake`);
    console.log(`Total em stake no contrato: ${formatACT(await staking.totalStaked())}`);
  } else {
    const stakeAmount = ethers.parseEther("50");
    console.log(`\nAprovando ${formatACT(stakeAmount)} para o contrato Staking...`);
    await accessToken.approve(contracts.Staking, stakeAmount);
    console.log("Fazendo stake...");
    await staking.stake(stakeAmount);
    console.log(`✅ Stake de ${formatACT(stakeAmount)} realizado`);
    console.log(`Total em stake no contrato: ${formatACT(await staking.totalStaked())}`);
  }

  // =======================
  // ETAPA 3: Governança DAO
  // =======================
  console.log("\n--- ETAPA 3: Governança DAO ---");

  const totalPropostas = await governance.proposalCount();
  console.log(`Propostas existentes: ${totalPropostas}`);

  console.log("Criando nova proposta...");
  const desc = "Adicionar suporte a NFTs ERC-1155 como acesso Premium ao AccessDAO";
  const createTx = await governance.createProposal(desc);
  const createReceipt = await createTx.wait();
  const createEvent = createReceipt.logs.find(
    l => l.fragment && l.fragment.name === "ProposalCreated"
  );
  const proposalId = createEvent.args[0];
  console.log(`✅ Proposta #${proposalId} criada`);
  console.log(`   Descrição: "${desc.substring(0, 55)}..."`);

  const proposta = await governance.getProposal(proposalId);
  const deadline = new Date(Number(proposta.deadline) * 1000);
  console.log(`   Votação aberta até: ${deadline.toLocaleString("pt-BR")}`);

  const podeVotar = await governance.canVote(deployer.address, proposalId);
  if (podeVotar) {
    console.log("\nVotando A FAVOR...");
    await governance.vote(proposalId, true);
    console.log("✅ Voto registrado");
  } else {
    console.log("✅ Voto já registrado nesta proposta");
  }

  const propostaAtualizada = await governance.getProposal(proposalId);
  console.log(`\nVotos a favor:  ${propostaAtualizada.votesFor}`);
  console.log(`Votos contra:   ${propostaAtualizada.votesAgainst}`);
  console.log(`Status: ${await governance.getProposalStatus(proposalId)}`);

  // =======================
  // RESUMO FINAL
  // =======================
  console.log("\n========================================");
  console.log("✅ NFT mintado | ✅ Stake feito | ✅ DAO votada");
  console.log("AccessDAO funcionando na Sepolia! 🎉");
  console.log("========================================");
  console.log(`\nEtherscan — AccessToken:   https://sepolia.etherscan.io/address/${contracts.AccessToken}`);
  console.log(`Etherscan — MembershipNFT: https://sepolia.etherscan.io/address/${contracts.MembershipNFT}`);
  console.log(`Etherscan — Staking:       https://sepolia.etherscan.io/address/${contracts.Staking}`);
  console.log(`Etherscan — Governance:    https://sepolia.etherscan.io/address/${contracts.Governance}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  });