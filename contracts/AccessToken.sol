// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Importamos as bibliotecas da OpenZeppelin - são contratos auditados e seguros
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AccessToken (ACT)
 * @dev Token ERC-20 do protocolo AccessDAO.
 *
 * PARA QUE SERVE:
 * - Pagar por memberships (NFTs)
 * - Fazer staking para ganhar recompensas
 * - Participar da governança
 *
 * PADRÃO ERC-20 ESCOLHIDO PORQUE:
 * - É o padrão fungível da Ethereum (todos os tokens são iguais)
 * - Compatível com todas as DEXs, carteiras e protocolos DeFi
 * - Permite transferências e aprovações padronizadas
 */
contract AccessToken is ERC20, Ownable {
    // Suprimento máximo: 100 milhões de tokens (com 18 casas decimais)
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;

    // Evento emitido quando tokens são queimados
    event TokensBurned(address indexed burner, uint256 amount);

    /**
     * @dev Construtor: define nome, símbolo e faz mint inicial
     * O msg.sender é quem faz o deploy — vira o "owner" do contrato
     */
    constructor() ERC20("AccessToken", "ACT") Ownable(msg.sender) {
        // Mintamos 10 milhões para o deployer (para distribuição inicial)
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }

    /**
     * @dev Permite ao owner mintar novos tokens
     * Protegido por onlyOwner — só o dono do contrato pode chamar
     *
     * @param to     Endereço que vai receber os tokens
     * @param amount Quantidade a ser mintada (com 18 decimais)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "AccessToken: mint para endereco zero");
        require(totalSupply() + amount <= MAX_SUPPLY, "AccessToken: excede suprimento maximo");
        _mint(to, amount);
    }

    /**
     * @dev Permite a qualquer usuário queimar seus próprios tokens
     * Queimar tokens reduz o suprimento total (deflacionário)
     *
     * @param amount Quantidade a ser queimada
     */
    function burn(uint256 amount) external {
        require(amount > 0, "AccessToken: quantidade deve ser maior que zero");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
}
