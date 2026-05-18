// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ReentrancyGuard: proteção contra ataques de reentrância
// Um ataque de reentrância ocorre quando um contrato malicioso
// chama nossa função de volta antes de terminarmos a execução
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/AggregatorV3Interface.sol";

/**
 * @title Staking
 * @dev Contrato de staking com recompensa dinâmica ajustada pelo preço do ETH.
 *
 * COMO FUNCIONA:
 * 1. Usuário deposita tokens ACT (stake)
 * 2. Recompensa acumula ao longo do tempo
 * 3. Taxa de recompensa sobe/desce com o preço do ETH (via Chainlink)
 * 4. Usuário pode sacar tokens + recompensas a qualquer momento
 *
 * LÓGICA DO ORACLE:
 * - ETH > $3.000 → taxa de recompensa aumenta 50% (mercado bullish)
 * - ETH < $1.500 → taxa de recompensa reduz 30% (mercado bearish)
 * - Entre esses valores → taxa base de 5% ao ano
 *
 * SEGURANÇA:
 * - ReentrancyGuard: bloqueia chamadas reentrantes (nonReentrant)
 * - Ownable: só o owner pode alterar parâmetros críticos
 * - Checks-Effects-Interactions: atualizamos estado ANTES de transferir
 */
contract Staking is ReentrancyGuard, Ownable {
    // O token que pode ser depositado e ganho como recompensa
    IERC20 public immutable stakingToken;

    // Interface do Chainlink para buscar o preço ETH/USD
    AggregatorV3Interface public immutable priceFeed;

    // Taxa base anual em basis points (100 bp = 1%)
    // 500 = 5% ao ano
    uint256 public baseRewardRate = 500;

    // Struct que armazena informações de cada staker
    struct StakeInfo {
        uint256 amount; // Quantidade de tokens em stake
        uint256 lastClaimTime; // Timestamp do último claim de recompensa
    }

    // Mapeamento: endereço => informações do stake
    mapping(address => StakeInfo) public stakes;

    // Total de tokens em stake no contrato
    uint256 public totalStaked;

    // ========== EVENTOS ==========
    event Staked(address indexed user, uint256 amount, uint256 totalStakedNow);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward, uint256 ethPrice);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    // ========== CONSTRUTOR ==========
    constructor(address _stakingToken, address _priceFeed) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Staking: token invalido");
        require(_priceFeed != address(0), "Staking: oracle invalido");
        stakingToken = IERC20(_stakingToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // ========== FUNÇÕES PRINCIPAIS ==========

    /**
     * @dev Deposita tokens ACT no contrato de staking
     * O usuário precisa ter feito approve() antes de chamar esta função
     *
     * @param amount Quantidade de tokens a depositar
     *
     * PADRÃO CHECKS-EFFECTS-INTERACTIONS:
     * 1. CHECK: verificamos condições (require)
     * 2. EFFECTS: atualizamos o estado do contrato
     * 3. INTERACTIONS: fazemos a transferência externa
     */
    function stake(uint256 amount) external nonReentrant {
        // CHECK
        require(amount > 0, "Staking: quantidade deve ser maior que zero");

        // Se o usuário já tem stake, processamos as recompensas acumuladas
        if (stakes[msg.sender].amount > 0) {
            _claimReward(msg.sender);
        }

        // EFFECTS - atualizamos o estado ANTES da transferência
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].lastClaimTime = block.timestamp;
        totalStaked += amount;

        // INTERACTIONS - transferência do usuário para o contrato
        bool success = stakingToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Staking: falha na transferencia");

        emit Staked(msg.sender, amount, totalStaked);
    }

    /**
     * @dev Remove tokens do staking (junto com recompensas acumuladas)
     *
     * @param amount Quantidade de tokens a retirar
     */
    function unstake(uint256 amount) external nonReentrant {
        // CHECK
        require(amount > 0, "Staking: quantidade deve ser maior que zero");
        require(stakes[msg.sender].amount >= amount, "Staking: saldo insuficiente em stake");

        // Processa recompensas antes de unstake
        _claimReward(msg.sender);

        // EFFECTS - atualizamos ANTES de transferir
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        // INTERACTIONS
        bool success = stakingToken.transfer(msg.sender, amount);
        require(success, "Staking: falha na transferencia");

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @dev Coleta apenas as recompensas sem remover o stake
     */
    function claimReward() external nonReentrant {
        require(stakes[msg.sender].amount > 0, "Staking: nenhum token em stake");
        _claimReward(msg.sender);
    }

    /**
     * @dev Retirada de emergência (sem recompensas)
     * Usado se houver algum problema com o cálculo de recompensas
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakes[msg.sender].amount;
        require(amount > 0, "Staking: nada para retirar");

        // EFFECTS primeiro
        stakes[msg.sender].amount = 0;
        stakes[msg.sender].lastClaimTime = 0;
        totalStaked -= amount;

        // INTERACTIONS
        bool success = stakingToken.transfer(msg.sender, amount);
        require(success, "Staking: falha na transferencia de emergencia");

        emit Unstaked(msg.sender, amount);
    }

    // ========== FUNÇÕES DE CÁLCULO ==========

    /**
     * @dev Calcula a recompensa atual de um usuário
     * Fórmula: recompensa = (amount × taxaAjustada × tempo) / (365 dias × 10000)
     *
     * @param user Endereço do usuário
     * @return Recompensa em tokens ACT (com 18 decimais)
     */
    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory info = stakes[user];
        if (info.amount == 0) return 0;

        // Tempo desde o último claim em segundos
        uint256 timeElapsed = block.timestamp - info.lastClaimTime;

        // Taxa ajustada pelo preço do ETH
        uint256 adjustedRate = getAdjustedRewardRate();

        // Cálculo da recompensa anualizada
        // Exemplo: 1000 ACT × 750 taxa × 86400s / (31536000s × 10000) ≈ 0.206 ACT/dia
        return (info.amount * adjustedRate * timeElapsed) / (365 days * 10_000);
    }

    /**
     * @dev Retorna a taxa de recompensa atual ajustada pelo preço do ETH
     * Consulta o Chainlink Oracle para obter o preço atual
     */
    function getAdjustedRewardRate() public view returns (uint256) {
        uint256 ethPrice = getETHPrice();

        // Preço em USD com 8 casas decimais (padrão Chainlink)
        // $3.000 = 3000_00000000
        if (ethPrice > 3_000 * 10 ** 8) {
            // Mercado bullish: taxa +50%
            return (baseRewardRate * 150) / 100;
        } else if (ethPrice < 1_500 * 10 ** 8) {
            // Mercado bearish: taxa -30%
            return (baseRewardRate * 70) / 100;
        }

        // Mercado neutro: taxa base
        return baseRewardRate;
    }

    /**
     * @dev Busca o preço atual do ETH em USD via Chainlink
     * Retorna o preço com 8 casas decimais (padrão do Chainlink)
     *
     * Exemplo: $2.500 = 2500_00000000 = 250000000000
     */
    function getETHPrice() public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        // Validações de segurança do oracle
        require(price > 0, "Staking: preco invalido do oracle");
        require(updatedAt > 0, "Staking: rodada incompleta");
        require(answeredInRound >= roundId, "Staking: dados desatualizados");
        require(block.timestamp - updatedAt < 1 hours, "Staking: preco muito antigo");

        return uint256(price);
    }

    // ========== FUNÇÕES ADMINISTRATIVAS ==========

    /**
     * @dev Atualiza a taxa base de recompensa (owner only)
     * @param _newRate Nova taxa em basis points (ex: 500 = 5% ao ano)
     */
    function setBaseRewardRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Staking: taxa deve ser maior que zero");
        require(_newRate <= 5_000, "Staking: taxa maxima de 50% ao ano");
        uint256 oldRate = baseRewardRate;
        baseRewardRate = _newRate;
        emit RewardRateUpdated(oldRate, _newRate);
    }

    /**
     * @dev Deposita tokens de recompensa no contrato (owner only)
     * O contrato precisa ter saldo para pagar as recompensas
     */
    function fundRewards(uint256 amount) external onlyOwner {
        bool success = stakingToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Staking: falha ao depositar recompensas");
    }

    // ========== FUNÇÕES INTERNAS ==========

    /**
     * @dev Processa e envia as recompensas acumuladas para um usuário
     * Chamada internamente antes de stake/unstake
     */
    function _claimReward(address user) internal {
        uint256 reward = calculateReward(user);

        // Atualiza o timestamp ANTES de transferir (padrão CEI)
        stakes[user].lastClaimTime = block.timestamp;

        if (reward > 0) {
            uint256 ethPrice = getETHPrice();

            // Verifica se o contrato tem saldo suficiente
            uint256 contractBalance = stakingToken.balanceOf(address(this));
            if (contractBalance > totalStaked + reward) {
                bool success = stakingToken.transfer(user, reward);
                require(success, "Staking: falha ao pagar recompensa");
                emit RewardClaimed(user, reward, ethPrice);
            }
            // Se não tiver saldo suficiente, simplesmente não paga
            // (não reverte para não bloquear o unstake)
        }
    }
}
