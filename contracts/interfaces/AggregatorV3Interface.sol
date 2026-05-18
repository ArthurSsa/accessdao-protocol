// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AggregatorV3Interface
 * @dev Interface oficial do Chainlink para consumir price feeds.
 *
 * O Chainlink mantém contratos em várias redes que fornecem
 * preços de ativos em tempo real. Usamos esta interface para
 * buscar o preço ETH/USD no contrato de Staking.
 *
 * Endereço na Sepolia: 0x694AA1769357215DE4FAC081bf1f309aDC325306
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function version() external view returns (uint256);

    /**
     * @dev Retorna os dados da rodada mais recente do oracle
     * @return roundId     ID da rodada
     * @return answer      Preço atual (com 8 casas decimais para USD)
     * @return startedAt   Timestamp de início da rodada
     * @return updatedAt   Timestamp da última atualização
     * @return answeredInRound ID da rodada em que a resposta foi computada
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
