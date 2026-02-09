import { Web3 } from 'web3';
import dotenv from 'dotenv';

dotenv.config();

export interface BuyConfig {
    bnbAmount: string;           // Amount in BNB (e.g., "0.001")
    minTokensOut: string;        // Minimum tokens to receive (slippage protection)
    gasLimit: number;            // Gas limit for transaction
    gasPriceGwei: string;        // Gas price in Gwei for speed
    maxRetries: number;          // Max retry attempts on failure
    useHighPriorityGas: boolean; // Use higher gas for faster execution
}

const DEFAULT_BUY_CONFIG: BuyConfig = {
    bnbAmount: '0.001',
    minTokensOut: '0',
    gasLimit: 500000,            // Increased for safety
    gasPriceGwei: '3',           // 3 Gwei for faster execution
    maxRetries: 2,
    useHighPriorityGas: true,
};

export class TokenBuyer {
    private web3: Web3;
    private contract: any;
    private contractAddress: string;
    private privateKey: string;
    private walletAddress: string;
    private config: BuyConfig;
    private nonceCache: number | null = null;
    private lastNonceUpdate: number = 0;

    constructor(config?: Partial<BuyConfig>) {
        const rpcUrl = process.env.RPC_URL || "https://bsc-dataseed1.binance.org/";
        this.web3 = new Web3(rpcUrl);
        
        this.contractAddress = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
        
        const abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "token", "type": "address"},
                    {"internalType": "address", "name": "recipient", "type": "address"},
                    {"internalType": "uint256", "name": "amountBNB", "type": "uint256"},
                    {"internalType": "uint256", "name": "minTokensOut", "type": "uint256"}
                ],
                "name": "buyTokenAMAP",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ];
        
        this.contract = new this.web3.eth.Contract(abi, this.contractAddress);
        
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("Missing PRIVATE_KEY in .env file. Please add your wallet private key (without 0x prefix).");
        }
        if (privateKey.startsWith('0x')) {
            throw new Error("PRIVATE_KEY should not include '0x' prefix. Remove it and try again.");
        }
        this.privateKey = privateKey;
        
        const walletAddress = process.env.WALLET_ADDRESS;
        if (!walletAddress) {
            throw new Error("Missing WALLET_ADDRESS in .env file. Please add your wallet address (with 0x prefix).");
        }
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            throw new Error("WALLET_ADDRESS must be a valid Ethereum address (0x followed by 40 hex characters).");
        }
        this.walletAddress = walletAddress;
        
        this.config = { ...DEFAULT_BUY_CONFIG, ...config };
        
        console.log(' TokenBuyer initialized');
        console.log(`   Wallet: ${this.walletAddress}`);
        console.log(`   Buy amount: ${this.config.bnbAmount} BNB`);
        console.log(`   Gas price: ${this.config.gasPriceGwei} Gwei`);
    }

 
    private async getNonce(): Promise<number> {
        const now = Date.now();
        if (this.nonceCache !== null && (now - this.lastNonceUpdate) < 5000) {
            const nonce = this.nonceCache;
            this.nonceCache++; 
            return nonce;
        }
        
        const nonce = await this.web3.eth.getTransactionCount(this.walletAddress, 'pending');
        const nonceNum = Number(nonce);
        this.nonceCache = nonceNum + 1;
        this.lastNonceUpdate = now;
        return nonceNum;
    }

    private async getOptimizedGasPrice(): Promise<string> {
        if (!this.config.useHighPriorityGas) {
            return this.web3.utils.toWei(this.config.gasPriceGwei, 'gwei');
        }
        
        try {
            // Get current network gas price
            const currentGasPrice = await this.web3.eth.getGasPrice();
            const currentGasPriceGwei = Number(this.web3.utils.fromWei(currentGasPrice, 'gwei'));
            
            // Add 20% boost for priority
            const boostedGasPriceGwei = currentGasPriceGwei * 1.2;
            
            // Use the higher of: configured gas or boosted network gas
            const configuredGasPriceGwei = Number(this.config.gasPriceGwei);
            const finalGasPriceGwei = Math.max(boostedGasPriceGwei, configuredGasPriceGwei);
            
            return this.web3.utils.toWei(finalGasPriceGwei.toFixed(2), 'gwei');
        } catch (error) {
            console.warn('⚠️  Failed to get current gas price, using configured value');
            return this.web3.utils.toWei(this.config.gasPriceGwei, 'gwei');
        }
    }


    async buyToken(tokenAddress: string, recipientAddress?: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        const startTime = Date.now();
        const recipient = recipientAddress || this.walletAddress;
        
        console.log(`\n Initiating buy for token: ${tokenAddress}`);
        
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 Retry attempt ${attempt}/${this.config.maxRetries}`);
                }
                
                const bnbAmountWei = this.web3.utils.toWei(this.config.bnbAmount, 'ether');
                const nonce = await this.getNonce();
                const gasPrice = await this.getOptimizedGasPrice();
                
                const txData = this.contract.methods.buyTokenAMAP(
                    tokenAddress,
                    recipient,
                    bnbAmountWei,
                    this.config.minTokensOut
                ).encodeABI();

                const tx = {
                    from: this.walletAddress,
                    to: this.contractAddress,
                    value: bnbAmountWei,
                    data: txData,
                    gas: this.config.gasLimit,
                    gasPrice: gasPrice,
                    nonce: nonce,
                    chainId: 56
                };

                const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.privateKey);
                
                if (!signedTx.rawTransaction) {
                    throw new Error('Failed to sign transaction');
                }

                const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
                const txHash = receipt.transactionHash;
                
                const executionTime = Date.now() - startTime;
                console.log(`⚡ Transaction sent in ${executionTime}ms`);
                console.log(`📤 TX Hash: ${txHash}`);

                return { 
                    success: true, 
                    txHash: txHash.toString()
                };
                
            } catch (error: any) {
                const errorMsg = error?.message || String(error);
                console.error(`❌ Buy attempt ${attempt} failed:`, errorMsg);
                
                // Provide helpful error messages
                if (errorMsg.includes('insufficient funds')) {
                    console.error('💡 Tip: Ensure you have sufficient BNB for gas + purchase amount');
                    return { 
                        success: false, 
                        error: 'Insufficient funds. Check your BNB balance.' 
                    };
                }
                
                if (errorMsg.includes('nonce too low') || errorMsg.includes('nonce')) {
                    console.warn('⚠️  Nonce issue detected, resetting cache...');
                    this.nonceCache = null;
                    // Continue to retry
                }
                
                if (errorMsg.includes('PRIVATE_KEY') || errorMsg.includes('private key')) {
                    console.error('💡 Tip: Check your PRIVATE_KEY in .env file (should not include 0x prefix)');
                    return { 
                        success: false, 
                        error: 'Invalid private key configuration' 
                    };
                }
                
                if (errorMsg.includes('gas') || errorMsg.includes('Gas')) {
                    console.warn('💡 Tip: Try increasing BUY_GAS_PRICE_GWEI in .env for faster inclusion');
                }
                
                if (errorMsg.includes('revert') || errorMsg.includes('execution reverted')) {
                    console.error('💡 Tip: Transaction was reverted. Check token address and contract state.');
                }
                
                if (attempt === this.config.maxRetries) {
                    return { 
                        success: false, 
                        error: `Failed after ${this.config.maxRetries} attempts: ${errorMsg}` 
                    };
                }
                
                // Exponential backoff: 500ms, 1000ms, 1500ms...
                const delay = attempt * 500;
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return { 
            success: false, 
            error: 'Max retries exceeded' 
        };
    }

    updateConfig(config: Partial<BuyConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('  Buy configuration updated');
    }

 
    getConfig(): BuyConfig {
        return { ...this.config };
    }
}

export { DEFAULT_BUY_CONFIG };