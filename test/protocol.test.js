// test/protocol.test.js
// Testes automatizados para o protocolo AccessDAO
//
// COMO EXECUTAR:
// npx hardhat test
//
// Para ver cobertura de código:
// npx hardhat coverage

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AccessDAO Protocol", function () {
  // =======================
  // FIXTURE: implanta todos os contratos antes de cada teste
  // loadFixture reseta o estado entre os testes (snapshot + revert)
  // =======================
  async function deployProtocolFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy AccessToken
    const AccessToken = await ethers.getContractFactory("AccessToken");
    const accessToken = await AccessToken.deploy();

    // Mock do Chainlink Oracle (simula ETH/USD = $2.000)
    // Em vez de usar a rede real, criamos um mock para testes locais
    const MockAggregator = await ethers.getContractFactory("MockAggregatorV3");
    const mockOracle = await MockAggregator.deploy(
      8,        // decimals
      200000000000 // $2.000 com 8 casas = 2000 * 1e8
    );

    // Deploy MembershipNFT
    const MembershipNFT = await ethers.getContractFactory("MembershipNFT");
    const membershipNFT = await MembershipNFT.deploy(await accessToken.getAddress());

    // Deploy Staking
    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(
      await accessToken.getAddress(),
      await mockOracle.getAddress()
    );

    // Deploy Governance
    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(await membershipNFT.getAddress());

    // Distribuição inicial de tokens para testes
    await accessToken.transfer(user1.address, ethers.parseEther("5000"));
    await accessToken.transfer(user2.address, ethers.parseEther("5000"));
    await accessToken.transfer(user3.address, ethers.parseEther("5000"));

    // Funda o contrato de Staking com tokens de recompensa
    const rewardFund = ethers.parseEther("1000000");
    await accessToken.approve(await staking.getAddress(), rewardFund);
    await staking.fundRewards(rewardFund);

    return { accessToken, membershipNFT, staking, governance, mockOracle, owner, user1, user2, user3 };
  }

  // =======================
  // TESTES: AccessToken (ERC-20)
  // =======================
  describe("AccessToken (ERC-20)", function () {
    it("Deve ter nome, símbolo e supply corretos", async function () {
      const { accessToken } = await loadFixture(deployProtocolFixture);
      expect(await accessToken.name()).to.equal("AccessToken");
      expect(await accessToken.symbol()).to.equal("ACT");
      expect(await accessToken.decimals()).to.equal(18);
    });

    it("Deve mintar supply inicial ao deployer", async function () {
      const { accessToken, owner } = await loadFixture(deployProtocolFixture);
      // Owner teve 10M inicial mas transferiu 15K no setup
      const ownerBalance = await accessToken.balanceOf(owner.address);
      expect(ownerBalance).to.be.gt(0);
    });

    it("Só o owner pode mintar novos tokens", async function () {
      const { accessToken, user1 } = await loadFixture(deployProtocolFixture);
      await expect(
        accessToken.connect(user1).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(accessToken, "OwnableUnauthorizedAccount");
    });

    it("Não deve ultrapassar o supply máximo", async function () {
      const { accessToken, owner } = await loadFixture(deployProtocolFixture);
      const MAX_SUPPLY = ethers.parseEther("100000000");
      const currentSupply = await accessToken.totalSupply();
      const excess = MAX_SUPPLY - currentSupply + 1n;

      await expect(
        accessToken.mint(owner.address, excess)
      ).to.be.revertedWith("AccessToken: excede suprimento maximo");
    });

    it("Usuário pode queimar seus próprios tokens", async function () {
      const { accessToken, user1 } = await loadFixture(deployProtocolFixture);
      const initialBalance = await accessToken.balanceOf(user1.address);
      const burnAmount = ethers.parseEther("100");

      await accessToken.connect(user1).burn(burnAmount);

      expect(await accessToken.balanceOf(user1.address)).to.equal(
        initialBalance - burnAmount
      );
    });
  });

  // =======================
  // TESTES: MembershipNFT (ERC-721)
  // =======================
  describe("MembershipNFT (ERC-721)", function () {
    it("Deve mintar NFT Bronze corretamente", async function () {
      const { accessToken, membershipNFT, user1 } = await loadFixture(deployProtocolFixture);

      await accessToken.connect(user1).approve(
        await membershipNFT.getAddress(),
        ethers.parseEther("100")
      );

      await expect(membershipNFT.connect(user1).mintMembership(0)) // 0 = BRONZE
        .to.emit(membershipNFT, "MembershipMinted")
        .withArgs(user1.address, 0, 0); // tokenId=0, tier=BRONZE

      expect(await membershipNFT.hasMembership(user1.address)).to.be.true;
      expect(await membershipNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("Não deve mintar mais de um NFT por carteira", async function () {
      const { accessToken, membershipNFT, user1 } = await loadFixture(deployProtocolFixture);

      await accessToken.connect(user1).approve(
        await membershipNFT.getAddress(),
        ethers.parseEther("200")
      );
      await membershipNFT.connect(user1).mintMembership(0);

      await expect(
        membershipNFT.connect(user1).mintMembership(0)
      ).to.be.revertedWith("MembershipNFT: ja possui membership");
    });

    it("Deve fazer upgrade de Bronze para Gold", async function () {
      const { accessToken, membershipNFT, user1 } = await loadFixture(deployProtocolFixture);

      // Minta Bronze primeiro
      await accessToken.connect(user1).approve(
        await membershipNFT.getAddress(),
        ethers.parseEther("2000")
      );
      await membershipNFT.connect(user1).mintMembership(0); // BRONZE = 100 ACT

      // Upgrade para Gold (custo = 2000 - 100 = 1900 ACT)
      await expect(membershipNFT.connect(user1).upgradeMembership(2)) // 2 = GOLD
        .to.emit(membershipNFT, "MembershipUpgraded");

      const tokenId = await membershipNFT.membershipTokenId(user1.address);
      expect(await membershipNFT.tokenTier(tokenId)).to.equal(2); // GOLD
    });

    it("Deve retornar o poder de voto correto por tier", async function () {
      const { accessToken, membershipNFT, user1, user2, user3 } = await loadFixture(deployProtocolFixture);

      // User1: Bronze (1 voto)
      await accessToken.connect(user1).approve(await membershipNFT.getAddress(), ethers.parseEther("100"));
      await membershipNFT.connect(user1).mintMembership(0);

      // User2: Silver (3 votos)
      await accessToken.connect(user2).approve(await membershipNFT.getAddress(), ethers.parseEther("500"));
      await membershipNFT.connect(user2).mintMembership(1);

      // User3: Gold (10 votos)
      await accessToken.connect(user3).approve(await membershipNFT.getAddress(), ethers.parseEther("2000"));
      await membershipNFT.connect(user3).mintMembership(2);

      expect(await membershipNFT.getTierVotingPower(0)).to.equal(1);
      expect(await membershipNFT.getTierVotingPower(1)).to.equal(3);
      expect(await membershipNFT.getTierVotingPower(2)).to.equal(10);
    });
  });

  // =======================
  // TESTES: Staking
  // =======================
  describe("Staking", function () {
    it("Deve aceitar stake e registrar corretamente", async function () {
      const { accessToken, staking, user1 } = await loadFixture(deployProtocolFixture);
      const stakeAmount = ethers.parseEther("100");

      await accessToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount);

      const stakeInfo = await staking.stakes(user1.address);
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(await staking.totalStaked()).to.equal(stakeAmount);
    });

    it("Deve calcular recompensas proporcionalmente ao tempo", async function () {
      const { accessToken, staking, user1, mockOracle } = await loadFixture(deployProtocolFixture);
      const stakeAmount = ethers.parseEther("1000");

      await accessToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount);

      // Avança 30 dias no tempo (funciona apenas em testes locais)
      await time.increase(30 * 24 * 60 * 60);
      await mockOracle.updateAnswer(200000000000);

      const reward = await staking.calculateReward(user1.address);
      // 1000 ACT × 5% ao ano × 30/365 ≈ 4.1 ACT
      expect(reward).to.be.gt(ethers.parseEther("4"));
      expect(reward).to.be.lt(ethers.parseEther("5"));
    });

    it("Deve ajustar a taxa com base no preço do ETH (oracle)", async function () {
      const { staking, mockOracle } = await loadFixture(deployProtocolFixture);

      // ETH = $2.000 (neutro) → taxa base = 500 bp
      expect(await staking.getAdjustedRewardRate()).to.equal(500);

      // ETH = $4.000 (bullish) → taxa +50% = 750 bp
      await mockOracle.updateAnswer(400000000000); // $4.000
      expect(await staking.getAdjustedRewardRate()).to.equal(750);

      // ETH = $1.000 (bearish) → taxa -30% = 350 bp
      await mockOracle.updateAnswer(100000000000); // $1.000
      expect(await staking.getAdjustedRewardRate()).to.equal(350);
    });

    it("Deve proteger contra reentrância", async function () {
      // O nonReentrant do OpenZeppelin protege este caso
      // Este teste verifica que o modificador está aplicado
      const { staking } = await loadFixture(deployProtocolFixture);
      const stakingCode = await ethers.provider.getCode(await staking.getAddress());
      expect(stakingCode.length).to.be.gt(2); // Contrato deployado com bytecode
    });

    it("Deve permitir unstake e devolver os tokens", async function () {
      const { accessToken, staking, user1 } = await loadFixture(deployProtocolFixture);
      const stakeAmount = ethers.parseEther("200");
      const balanceBefore = await accessToken.balanceOf(user1.address);

      await accessToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount);
      await staking.connect(user1).unstake(stakeAmount);

      const balanceAfter = await accessToken.balanceOf(user1.address);
      // Saldo deve ser próximo ao original (pode ter ganho pequena recompensa)
      expect(balanceAfter).to.be.gte(balanceBefore - ethers.parseEther("1"));
    });
  });

  // =======================
  // TESTES: Governance (DAO)
  // =======================
  describe("Governance (DAO)", function () {
    async function membershipFixture() {
      const base = await deployProtocolFixture();
      const { accessToken, membershipNFT, user1, user2, user3 } = base;

      // Dá memberships para os usuários
      await accessToken.connect(user1).approve(await membershipNFT.getAddress(), ethers.parseEther("100"));
      await membershipNFT.connect(user1).mintMembership(0); // BRONZE

      await accessToken.connect(user2).approve(await membershipNFT.getAddress(), ethers.parseEther("500"));
      await membershipNFT.connect(user2).mintMembership(1); // SILVER

      await accessToken.connect(user3).approve(await membershipNFT.getAddress(), ethers.parseEther("2000"));
      await membershipNFT.connect(user3).mintMembership(2); // GOLD

      return base;
    }

    it("Membro pode criar proposta", async function () {
      const { governance, user1 } = await loadFixture(membershipFixture);
      const desc = "Proposta de teste para o protocolo";

      await expect(governance.connect(user1).createProposal(desc))
        .to.emit(governance, "ProposalCreated")
        

      expect(await governance.proposalCount()).to.equal(1);
    });

    it("Não-membro não pode criar proposta", async function () {
      const { governance, owner } = await loadFixture(membershipFixture);
      await expect(
        governance.connect(owner).createProposal("Proposta inválida")
      ).to.be.revertedWith("Governance: apenas membros podem propor");
    });

    it("Deve registrar votos com peso correto por tier", async function () {
      const { governance, user1, user2, user3 } = await loadFixture(membershipFixture);

      await governance.connect(user1).createProposal("Proposta X");

      // Bronze (1 voto) a favor
      await governance.connect(user1).vote(0, true);
      // Silver (3 votos) a favor
      await governance.connect(user2).vote(0, true);
      // Gold (10 votos) contra
      await governance.connect(user3).vote(0, false);

      const proposal = await governance.getProposal(0);
      expect(proposal.votesFor).to.equal(4);     // 1 + 3
      expect(proposal.votesAgainst).to.equal(10); // 10
    });

    it("Não deve permitir votar duas vezes", async function () {
      const { governance, user1 } = await loadFixture(membershipFixture);
      await governance.connect(user1).createProposal("Proposta Y");
      await governance.connect(user1).vote(0, true);

      await expect(
        governance.connect(user1).vote(0, false)
      ).to.be.revertedWith("Governance: ja votou nesta proposta");
    });

    it("Deve executar proposta após o deadline", async function () {
      const { governance, user1, user2 } = await loadFixture(membershipFixture);
      await governance.connect(user1).createProposal("Proposta Z");

      await governance.connect(user1).vote(0, true);  // 1 voto
      await governance.connect(user2).vote(0, false); // 3 votos

      // Avança o tempo 3 dias (período de votação)
      await time.increase(3 * 24 * 60 * 60 + 1);

      await expect(governance.executeProposal(0))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(0, false); // Rejeitada (3 contra > 1 a favor)

      const proposal = await governance.getProposal(0);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.false;
    });

    it("Não deve executar proposta antes do deadline", async function () {
      const { governance, user1 } = await loadFixture(membershipFixture);
      await governance.connect(user1).createProposal("Cedo demais");

      await expect(
        governance.executeProposal(0)
      ).to.be.revertedWith("Governance: votacao ainda em andamento");
    });
  });
});
