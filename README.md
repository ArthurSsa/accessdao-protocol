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
git clone https://github.com/ArthurSsa/accessdao-protocol
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

# Executa os testes (20 testes passando)
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

## Endereços na Sepolia

| Contrato | Endereço | Etherscan |
|----------|----------|-----------|
| AccessToken (ACT) | `0x1Ee6E552eeD8886C827faDa6c18a0Fe342dC52E4` | [Ver](https://sepolia.etherscan.io/address/0x1Ee6E552eeD8886C827faDa6c18a0Fe342dC52E4) |
| MembershipNFT (ADM) | `0xD9C7ee7F7Db0e347b7F993Bd0b4820A56c3d159B` | [Ver](https://sepolia.etherscan.io/address/0xD9C7ee7F7Db0e347b7F993Bd0b4820A56c3d159B) |
| Staking | `0x2aDdfB89fCC3B745056600f99BBeB97c4d2fF135` | [Ver](https://sepolia.etherscan.io/address/0x2aDdfB89fCC3B745056600f99BBeB97c4d2fF135) |
| Governance | `0xA91ade698306cCFCDb720Cb88A6B318DdcB5e4e2` | [Ver](https://sepolia.etherscan.io/address/0xA91ade698306cCFCDb720Cb88A6B318DdcB5e4e2) |

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
- ✅ Solidity `^0.8.26` com EVM Cancun
- ✅ Validação de dados do oracle (staleness check)
- ✅ Endereços críticos imutáveis (`immutable`)
- ✅ Função de retirada de emergência

Veja o relatório completo em [AUDITORIA.md](./AUDITORIA.md).

---

## Resultados dos Testes

```
AccessDAO Protocol
  AccessToken (ERC-20)
    ✔ Deve ter nome, símbolo e supply corretos
    ✔ Deve mintar supply inicial ao deployer
    ✔ Só o owner pode mintar novos tokens
    ✔ Não deve ultrapassar o supply máximo
    ✔ Usuário pode queimar seus próprios tokens
  MembershipNFT (ERC-721)
    ✔ Deve mintar NFT Bronze corretamente
    ✔ Não deve mintar mais de um NFT por carteira
    ✔ Deve fazer upgrade de Bronze para Gold
    ✔ Deve retornar o poder de voto correto por tier
  Staking
    ✔ Deve aceitar stake e registrar corretamente
    ✔ Deve calcular recompensas proporcionalmente ao tempo
    ✔ Deve ajustar a taxa com base no preço do ETH (oracle)
    ✔ Deve proteger contra reentrância
    ✔ Deve permitir unstake e devolver os tokens
  Governance (DAO)
    ✔ Membro pode criar proposta
    ✔ Não-membro não pode criar proposta
    ✔ Deve registrar votos com peso correto por tier
    ✔ Não deve permitir votar duas vezes
    ✔ Deve executar proposta após o deadline
    ✔ Não deve executar proposta antes do deadline

20 passing (596ms)
```

---

## Tecnologias

- Solidity 0.8.26 (EVM Cancun)
- Hardhat
- OpenZeppelin Contracts v5
- Chainlink Price Feeds
- ethers.js v6
- Node.js v24

---

## Licença

MIT
