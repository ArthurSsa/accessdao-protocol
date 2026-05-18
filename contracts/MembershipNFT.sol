// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MembershipNFT
 * @dev NFT ERC-721 que representa memberships com 3 níveis (tiers).
 *
 * PARA QUE SERVE:
 * - Cada NFT = 1 membership (acesso à plataforma)
 * - 3 tiers com preços e poderes de voto diferentes
 * - Usuários podem fazer upgrade pagando a diferença em ACT
 *
 * POR QUE ERC-721 (e não ERC-1155)?
 * - Cada membership é única (1 NFT por carteira)
 * - ERC-721 é o padrão de NFTs únicos (non-fungible)
 * - ERC-1155 seria melhor se houvesse cópias idênticas
 *
 * TIERS:
 * - BRONZE: 100 ACT, poder de voto = 1
 * - SILVER: 500 ACT, poder de voto = 3
 * - GOLD:   2000 ACT, poder de voto = 10
 */
contract MembershipNFT is ERC721URIStorage, Ownable {
    // Enum para os tiers (uint8: 0=BRONZE, 1=SILVER, 2=GOLD)
    enum Tier {
        BRONZE,
        SILVER,
        GOLD
    }

    // Contador de tokens (começa em 0)
    uint256 private _tokenIdCounter;

    // Referência ao contrato do token ACT
    IERC20 public immutable accessToken;

    // Preços dos tiers em ACT (com 18 decimais)
    uint256 public constant BRONZE_PRICE = 100 * 10 ** 18;
    uint256 public constant SILVER_PRICE = 500 * 10 ** 18;
    uint256 public constant GOLD_PRICE = 2_000 * 10 ** 18;

    // Mapeamento: tokenId => Tier
    mapping(uint256 => Tier) public tokenTier;

    // Mapeamento: endereço => tem membership?
    mapping(address => bool) public hasMembership;

    // Mapeamento: endereço => ID do seu NFT
    mapping(address => uint256) public membershipTokenId;

    // URIs dos metadados (idealmente IPFS)
    string public bronzeURI;
    string public silverURI;
    string public goldURI;

    // ========== EVENTOS ==========
    // Eventos são logs permanentes na blockchain — úteis para indexar dados
    event MembershipMinted(address indexed member, uint256 tokenId, Tier tier);
    event MembershipUpgraded(
        address indexed member,
        uint256 tokenId,
        Tier oldTier,
        Tier newTier
    );

    // ========== CONSTRUTOR ==========
    constructor(address _accessToken) ERC721("AccessDAO Membership", "ADM") Ownable(msg.sender) {
        require(_accessToken != address(0), "MembershipNFT: endereco invalido");
        accessToken = IERC20(_accessToken);

        // URIs padrão (devem ser atualizadas para IPFS real antes do deploy)
        bronzeURI = "ipfs://QmBronzeMetadataHashAqui";
        silverURI = "ipfs://QmSilverMetadataHashAqui";
        goldURI = "ipfs://QmGoldMetadataHashAqui";
    }

    // ========== FUNÇÕES PRINCIPAIS ==========

    /**
     * @dev Minta uma nova membership NFT
     * O usuário deve:
     * 1. Ter tokens ACT suficientes
     * 2. Ter aprovado este contrato para gastar seus tokens (approve)
     * 3. Não ter membership ainda
     *
     * @param tier O nível desejado (0=BRONZE, 1=SILVER, 2=GOLD)
     */
    function mintMembership(Tier tier) external {
        require(!hasMembership[msg.sender], "MembershipNFT: ja possui membership");

        uint256 price = _getTierPrice(tier);

        // transferFrom move tokens do usuário para este contrato
        // Requer approve() prévio do usuário
        bool success = accessToken.transferFrom(msg.sender, address(this), price);
        require(success, "MembershipNFT: falha na transferencia de tokens");

        // Pega o próximo ID e incrementa o contador
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Minta o NFT para o usuário
        _safeMint(msg.sender, tokenId);

        // Define os metadados (imagem, atributos) baseados no tier
        _setTokenURI(tokenId, _getTierURI(tier));

        // Registra o tier e a ownership
        tokenTier[tokenId] = tier;
        hasMembership[msg.sender] = true;
        membershipTokenId[msg.sender] = tokenId;

        emit MembershipMinted(msg.sender, tokenId, tier);
    }

    /**
     * @dev Faz upgrade do tier de uma membership existente
     * O usuário paga apenas a DIFERENÇA entre os preços
     *
     * @param newTier O novo tier desejado (deve ser maior que o atual)
     */
    function upgradeMembership(Tier newTier) external {
        require(hasMembership[msg.sender], "MembershipNFT: nao possui membership");

        uint256 tokenId = membershipTokenId[msg.sender];
        Tier currentTier = tokenTier[tokenId];

        require(uint8(newTier) > uint8(currentTier), "MembershipNFT: apenas upgrade permitido");

        // Calcula o custo do upgrade (diferença entre os preços)
        uint256 upgradeCost = _getTierPrice(newTier) - _getTierPrice(currentTier);

        bool success = accessToken.transferFrom(msg.sender, address(this), upgradeCost);
        require(success, "MembershipNFT: falha na transferencia de tokens");

        Tier oldTier = currentTier;
        tokenTier[tokenId] = newTier;
        _setTokenURI(tokenId, _getTierURI(newTier));

        emit MembershipUpgraded(msg.sender, tokenId, oldTier, newTier);
    }

    // ========== FUNÇÕES DE LEITURA ==========

    /**
     * @dev Retorna o poder de voto de um NFT baseado no tier
     * Usado pelo contrato de Governança
     */
    function getTierVotingPower(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "MembershipNFT: token inexistente");
        Tier tier = tokenTier[tokenId];
        if (tier == Tier.BRONZE) return 1;
        if (tier == Tier.SILVER) return 3;
        if (tier == Tier.GOLD) return 10;
        return 0;
    }

    /**
     * @dev Retorna o tier de um membro
     */
    function getMemberTier(address member) external view returns (Tier) {
        require(hasMembership[member], "MembershipNFT: nao eh membro");
        return tokenTier[membershipTokenId[member]];
    }

    // ========== FUNÇÕES ADMINISTRATIVAS ==========

    /**
     * @dev Atualiza os URIs dos metadados (owner only)
     * Use após fazer upload das imagens no IPFS
     */
    function setURIs(
        string calldata _bronzeURI,
        string calldata _silverURI,
        string calldata _goldURI
    ) external onlyOwner {
        bronzeURI = _bronzeURI;
        silverURI = _silverURI;
        goldURI = _goldURI;
    }

    /**
     * @dev Retira os tokens ACT acumulados pelas vendas (owner only)
     */
    function withdrawTokens() external onlyOwner {
        uint256 balance = accessToken.balanceOf(address(this));
        require(balance > 0, "MembershipNFT: sem saldo para retirar");
        accessToken.transfer(owner(), balance);
    }

    // ========== FUNÇÕES INTERNAS ==========

    function _getTierPrice(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.BRONZE) return BRONZE_PRICE;
        if (tier == Tier.SILVER) return SILVER_PRICE;
        if (tier == Tier.GOLD) return GOLD_PRICE;
        revert("MembershipNFT: tier invalido");
    }

    function _getTierURI(Tier tier) internal view returns (string memory) {
        if (tier == Tier.BRONZE) return bronzeURI;
        if (tier == Tier.SILVER) return silverURI;
        if (tier == Tier.GOLD) return goldURI;
        revert("MembershipNFT: tier invalido");
    }
}
