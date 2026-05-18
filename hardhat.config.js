// hardhat.config.js
// Configuração do ambiente de desenvolvimento Hardhat
//
// Hardhat é o framework mais popular para desenvolvimento de smart contracts.
// Ele permite: compilar, testar, fazer deploy e verificar contratos.

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Carrega variáveis do arquivo .env

// Lê as variáveis de ambiente de forma segura
// NUNCA coloque chaves privadas diretamente no código!
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // =======================
  // COMPILADOR SOLIDITY
  // =======================
  solidity: {
    version: "0.8.26",
   settings: {
 	 optimizer: {
    	enabled: true,
    	runs: 200,
  	},
 	 evmVersion: "cancun",
  	viaIR: false,
    },
  },

  // =======================
  // REDES
  // =======================
  networks: {
    // Rede local para desenvolvimento (padrão do Hardhat)
    hardhat: {
      chainId: 31337,
    },

    // Sepolia Testnet (Ethereum testnet oficial)
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gasPrice: "auto",
    },
  },

  // =======================
  // VERIFICAÇÃO NO ETHERSCAN
  // =======================
  // Após o deploy, você pode verificar o código-fonte:
  // npx hardhat verify --network sepolia <ENDEREÇO> <CONSTRUTOR_ARGS...>
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },

  // =======================
  // COBERTURA DE TESTES
  // =======================
  // Configuração para o plugin hardhat-coverage
  // Execute: npx hardhat coverage
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  // =======================
  // PATHS
  // =======================
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
