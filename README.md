# AccessDAO Protocol

> Protocolo Web3 descentralizado de membership em NFT com staking, governança DAO e integração com oracle Chainlink.
>
> **Unidade 1 | Capítulo 5 — Residência em TIC 29 | Web 3.0**

---

## Problema que o Protocolo Resolve

Plataformas digitais exclusivas (comunidades, cursos, DAOs, clubes) precisam de um mecanismo 
de **acesso verificável e descentralizado** — sem depender de bancos de dados centralizados 
ou intermediários. O AccessDAO resolve isso emitindo **NFTs de membership** como credenciais 
on-chain, com governança coletiva e incentivos de staking.

---

## Arquitetura

```
Usuário
   │
   ▼
Frontend / ethers.js  ←── Mint NFT, Stake, Votar
   │
   ├──▶ AccessToken (ACT) ──ERC-20──▶ Staking ◀── Chainlink Oracle (ETH/USD)
   │
   ├──▶ MembershipNFT (ADM) ──ERC-721──▶ Governance (DAO)
   │
   └──── Todos na Sepolia Testnet ────────────────────────────────
```

### Contratos

| Contrato | Padrão | Descrição |
|----------|--------|-----------|
| `AccessToken.sol` | ERC-20 | Token ACT para pagamentos e staking |
| `MembershipNFT.sol` | ERC-721 | NFT de membership com 3 tiers |
| `Staking.sol` | — | Staking com recompensa ajustada por oracle |
| `Governance.sol` | — | DAO simplificada para propostas e votos |

### Tiers de Membership

| Tier | Preço | Poder de Voto |
|------|-------|---------------|
| 🥉 Bronze | 100 ACT | 1 voto |
| 🥈 Silver | 500 ACT | 3 votos |
| 🥇 Gold | 2.000 ACT | 10 votos |

---

## Pré-requisitos

- Node.js >= 18.0
- npm >= 8.0
- MetaMask com conta na Sepolia Testnet
- ETH de teste (obter em https://sepoliafaucet.com)

---

## Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/accessdao-protocol
cd accessdao-protocol

# Instala as dependências
npm install

# Copia e configura as variáveis de ambiente
cp .env.example .env
# Edite o .env com sua chave privada e RPC URL
```

---

## Compilação e Testes

```bash
# Compila os contratos
npm run compile

# Executa os testes
npm test

# Gera relatório de cobertura
npm run coverage
```

---

## Deploy na Sepolia

```bash
# 1. Configure o .env com:
#    PRIVATE_KEY=sua_chave_privada
#    SEPOLIA_RPC_URL=sua_url_rpc
#    ETHERSCAN_API_KEY=sua_chave_etherscan

# 2. Faça o deploy
npm run deploy:sepolia

# 3. Execute a demonstração
npm run interact:sepolia
```

---

## Endereços na Sepolia (após deploy)

> Preencha após fazer o deploy

| Contrato | Endereço | Etherscan |
|----------|----------|-----------|
| AccessToken (ACT) | `0x...` | [Ver](https://sepolia.etherscan.io/address/0x...) |
| MembershipNFT (ADM) | `0x...` | [Ver](https://sepolia.etherscan.io/address/0x...) |
| Staking | `0x...` | [Ver](https://sepolia.etherscan.io/address/0x...) |
| Governance | `0x...` | [Ver](https://sepolia.etherscan.io/address/0x...) |

**Oracle Chainlink ETH/USD (Sepolia):** `0x694AA1769357215DE4FAC081bf1f309aDC325306`

---

## Integração com Oracle Chainlink

O contrato de Staking usa o Chainlink Price Feed para ajustar dinamicamente a taxa 
de recompensa com base no preço do ETH:

- **ETH > $3.000** → Taxa aumenta 50% (mercado bullish)
- **ETH entre $1.500 e $3.000** → Taxa base de 5% ao ano
- **ETH < $1.500** → Taxa reduz 30% (mercado bearish)

---

## Segurança

- ✅ Proteção contra reentrância (`ReentrancyGuard` + padrão CEI)
- ✅ Controle de acesso (`Ownable` da OpenZeppelin)
- ✅ Solidity `^0.8.20` (overflow/underflow nativos)
- ✅ Validação de dados do oracle (staleness check)
- ✅ Endereços críticos imutáveis (`immutable`)
- ✅ Função de retirada de emergência

Veja o relatório completo em [AUDITORIA.md](./AUDITORIA.md).

---

## Tecnologias

- Solidity 0.8.20
- Hardhat
- OpenZeppelin Contracts v5
- Chainlink Price Feeds
- ethers.js v6

---

## Licença

MIT
