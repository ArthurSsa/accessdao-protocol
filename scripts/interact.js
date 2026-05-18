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

  // ETAPA 1: Mint de NFT Silver
  console.log("\n--- ETAPA 1: Mint de Membership NFT ---");
  const jaMembro = await membershipNFT.hasMembership(deployer.address);
  if (!jaMembro) {
    console.log("Aprovando 500 ACT para o contrato NFT...");
    await accessToken.approve(contracts.MembershipNFT, ethers.parseEther("500"));
    console.log("Mintando membership Silver...");
    const mintTx = await membershipNFT.mintMembership(1);
    const receipt = await mintTx.wait();
    const mintEvent = receipt.logs.find(l => l.fragment && l.fragment.name === "MembershipMinted");
    console.log(`✅ NFT #${mintEvent.args[1]} mintado (SILVER) - Poder de voto: 3`);
  } else {
    console.log("✅ Já possui membership NFT");
  }

  // ETAPA 2: Staking
  console.log("\n--- ETAPA 2: Staking de Tokens ACT ---");
  const ethPrice = await staking.getETHPrice();
  const rate = await staking.getAdjustedRewardRate();
  console.log(`Preço ETH/USD: $${(Number(ethPrice) / 1e8).toFixed(2)}`);
  console.log(`Taxa de recompensa: ${Number(rate) / 100}% ao ano`);

  const stakeAmount = ethers.parseEther("50");
  console.log(`\nAprovando ${formatACT(stakeAmount)} para o contrato Staking...`);
  await accessToken.approve(contracts.Staking, stakeAmount);
  console.log("Fazendo stake...");
  await staking.stake(stakeAmount);
  console.log(`✅ Stake de ${formatACT(stakeAmount)} realizado`);
  console.log(`Total em stake: ${formatACT(await staking.totalStaked())}`);

  // ETAPA 3: Governança
  console.log("\n--- ETAPA 3: Governança DAO ---");
  const desc = "Adicionar suporte a NFTs ERC-1155 como acesso Premium ao AccessDAO";
  console.log("Criando proposta...");
  const createTx = await governance.createProposal(desc);
  const createReceipt = await createTx.wait();
  const createEvent = createReceipt.logs.find(l => l.fragment && l.fragment.name === "ProposalCreated");
  const proposalId = createEvent.args[0];
  console.log(`✅ Proposta #${proposalId} criada`);

  console.log("Votando A FAVOR...");
  await governance.vote(proposalId, true);
  console.log("✅ Voto registrado");

  const proposta = await governance.getProposal(proposalId);
  console.log(`\nVotos a favor: ${proposta.votesFor}`);
  console.log(`Status: ${await governance.getProposalStatus(proposalId)}`);

  console.log("\n========================================");
  console.log("✅ NFT mintado | ✅ Stake feito | ✅ DAO votada");
  console.log("AccessDAO funcionando na Sepolia! 🎉");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error("❌ Erro:", error.message); process.exit(1); });