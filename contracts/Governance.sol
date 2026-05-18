// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MembershipNFT.sol";

/**
 * @title Governance
 * @dev DAO simplificada para membros do AccessDAO votarem em propostas.
 *
 * COMO FUNCIONA:
 * 1. Qualquer membro (com NFT) pode criar uma proposta
 * 2. Membros votam com poder proporcional ao tier do NFT:
 *    - BRONZE = 1 voto
 *    - SILVER = 3 votos
 *    - GOLD   = 10 votos
 * 3. Após o período de votação, qualquer um pode executar a proposta
 * 4. Proposta passa se votos_favor > votos_contra
 *
 * POR QUE DAO SIMPLIFICADA?
 * - DAOs completas (como Compound Governor) são muito complexas para um MVP
 * - Esta implementação demonstra os conceitos fundamentais
 * - Pode ser expandida com timelock, quorum, etc.
 *
 * SEGURANÇA:
 * - Controle de acesso: só membros podem criar e votar
 * - Anti-duplo-voto: mapping hasVoted impede votar duas vezes
 * - Proteção temporal: não pode executar antes do prazo
 */
contract Governance is Ownable {
    // Referência ao contrato de NFT (para verificar memberships)
    MembershipNFT public immutable membershipNFT;

    // Duração padrão do período de votação
    uint256 public votingPeriod = 3 days;

    // Contador de propostas (começa em 0)
    uint256 public proposalCount;

    // Struct que representa uma proposta
    struct Proposal {
        uint256 id; // ID único da proposta
        address proposer; // Quem criou a proposta
        string description; // Descrição do que está sendo votado
        uint256 votesFor; // Total de votos a favor
        uint256 votesAgainst; // Total de votos contra
        uint256 deadline; // Quando o período de votação termina
        bool executed; // Se já foi executada
        bool passed; // Se foi aprovada (válido após execução)
    }

    // Mapeamento: proposalId => Proposal
    mapping(uint256 => Proposal) public proposals;

    // Mapeamento: proposalId => endereço => já votou?
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ========== EVENTOS ==========
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 deadline
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );

    event ProposalExecuted(uint256 indexed proposalId, bool passed);

    // ========== CONSTRUTOR ==========
    constructor(address _membershipNFT) Ownable(msg.sender) {
        require(_membershipNFT != address(0), "Governance: endereco invalido");
        membershipNFT = MembershipNFT(_membershipNFT);
    }

    // ========== FUNÇÕES PRINCIPAIS ==========

    /**
     * @dev Cria uma nova proposta para votação
     * Apenas membros com NFT podem criar propostas
     *
     * @param description Texto descrevendo o que está sendo proposto
     * @return proposalId ID da proposta criada
     */
    function createProposal(string calldata description) external returns (uint256) {
        require(membershipNFT.hasMembership(msg.sender), "Governance: apenas membros podem propor");
        require(bytes(description).length > 0, "Governance: descricao vazia");
        require(bytes(description).length <= 1000, "Governance: descricao muito longa");

        uint256 proposalId = proposalCount;
        proposalCount++;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + votingPeriod,
            executed: false,
            passed: false
        });

        emit ProposalCreated(proposalId, msg.sender, description, proposals[proposalId].deadline);
        return proposalId;
    }

    /**
     * @dev Registra um voto em uma proposta
     *
     * @param proposalId ID da proposta
     * @param support    true = a favor, false = contra
     */
    function vote(uint256 proposalId, bool support) external {
        // Verificações de elegibilidade
        require(membershipNFT.hasMembership(msg.sender), "Governance: apenas membros podem votar");
        require(proposalId < proposalCount, "Governance: proposta inexistente");
        require(!hasVoted[proposalId][msg.sender], "Governance: ja votou nesta proposta");
        require(
            block.timestamp <= proposals[proposalId].deadline,
            "Governance: periodo de votacao encerrado"
        );

        // Busca o poder de voto baseado no tier do NFT
        uint256 tokenId = membershipNFT.membershipTokenId(msg.sender);
        uint256 votingPower = membershipNFT.getTierVotingPower(tokenId);

        // Registra o voto
        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposals[proposalId].votesFor += votingPower;
        } else {
            proposals[proposalId].votesAgainst += votingPower;
        }

        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }

    /**
     * @dev Finaliza e executa uma proposta após o período de votação
     * Qualquer pessoa pode chamar esta função após o deadline
     *
     * @param proposalId ID da proposta a executar
     */
    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Governance: proposta inexistente");

        Proposal storage proposal = proposals[proposalId];

        require(
            block.timestamp > proposal.deadline,
            "Governance: votacao ainda em andamento"
        );
        require(!proposal.executed, "Governance: proposta ja executada");

        // Marca como executada
        proposal.executed = true;

        // Determina o resultado
        proposal.passed = proposal.votesFor > proposal.votesAgainst;

        emit ProposalExecuted(proposalId, proposal.passed);

        // NOTA: Em uma DAO real, aqui executa-se a ação da proposta
        // Por exemplo: chamar uma função de outro contrato
        // Neste MVP, registramos apenas o resultado on-chain
    }

    // ========== FUNÇÕES DE LEITURA ==========

    /**
     * @dev Retorna todos os dados de uma proposta
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposalId < proposalCount, "Governance: proposta inexistente");
        return proposals[proposalId];
    }

    /**
     * @dev Retorna o status atual de uma proposta
     */
    function getProposalStatus(uint256 proposalId) external view returns (string memory) {
        require(proposalId < proposalCount, "Governance: proposta inexistente");
        Proposal memory p = proposals[proposalId];

        if (p.executed) {
            return p.passed ? "Aprovada" : "Rejeitada";
        }
        if (block.timestamp <= p.deadline) {
            return "Em votacao";
        }
        return "Aguardando execucao";
    }

    /**
     * @dev Verifica se um usuário pode votar em uma proposta
     */
    function canVote(address user, uint256 proposalId) external view returns (bool) {
        if (!membershipNFT.hasMembership(user)) return false;
        if (proposalId >= proposalCount) return false;
        if (hasVoted[proposalId][user]) return false;
        if (block.timestamp > proposals[proposalId].deadline) return false;
        return true;
    }

    // ========== FUNÇÕES ADMINISTRATIVAS ==========

    /**
     * @dev Atualiza o período de votação (owner only)
     * @param _period Duração em segundos (mínimo 1 dia, máximo 30 dias)
     */
    function setVotingPeriod(uint256 _period) external onlyOwner {
        require(_period >= 1 days, "Governance: periodo minimo de 1 dia");
        require(_period <= 30 days, "Governance: periodo maximo de 30 dias");
        votingPeriod = _period;
    }
}
