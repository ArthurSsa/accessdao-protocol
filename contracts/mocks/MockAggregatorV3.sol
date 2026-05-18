// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAggregatorV3
 * @dev Mock do Chainlink Price Feed para uso em testes locais.
 * Permite simular diferentes preços de ETH sem precisar de rede real.
 *
 * ATENÇÃO: Este contrato é APENAS para testes. Nunca usar em produção.
 */
contract MockAggregatorV3 {
    uint8 private _decimals;
    int256 private _answer;
    uint256 private _updatedAt;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "ETH / USD (Mock para testes)";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    /**
     * @dev Simula a resposta do oracle
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
        )
    {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }

    /**
     * @dev Permite atualizar o preço simulado durante os testes
     */
    function updateAnswer(int256 newAnswer) external {
        _answer = newAnswer;
        _updatedAt = block.timestamp;
    }
}
