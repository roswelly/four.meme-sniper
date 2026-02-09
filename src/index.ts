import { Web3, Log } from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getConfig, PerformanceMonitor, getMemoryUsage } from './config';
import { TokenBuyer, BuyConfig } from './buy';

// Load environment variables
dotenv.config();


const web3 = new Web3('wss://bsc.publicnode.com');
const eventAbi = [
    { type: 'address', name: 'creator' },
    { type: 'address', name: 'token' },
    { type: 'uint256', name: 'requestId' },
    { type: 'string', name: 'name' },
    { type: 'string', name: 'symbol' },
    { type: 'uint256', name: 'totalSupply' },
    { type: 'uint256', name: 'launchTime' },
    { type: 'uint256', name: 'launchFee' }
];

// Token data interface
interface TokenMint {
    tokenAddress: string;
    name: string;
    symbol: string;
    creator: string;
    timestamp: string;
    transactionHash: string;
    initialSupply: string;
    requestId: string;
    launchTime: string;
    launchFee: string;
    blockNumber: number;
    logIndex: number;
}

// File paths
const WHITELIST_FILE = path.join(__dirname, 'list', 'whitelist.json');



// Real-time WebSocket subscription approach
const processedTxs = new Set<string>();

// Performance optimizations for scalability
const config = getConfig();
const WHITELIST_CACHE = new Set<string>();
const performanceMonitor = new PerformanceMonitor();

// Auto-buy configuration
const AUTO_BUY_ENABLED = process.env.AUTO_BUY_ENABLED === 'true';
const BUY_AMOUNT_BNB = process.env.BUY_AMOUNT_BNB || '0.001';
const BUY_GAS_PRICE_GWEI = process.env.BUY_GAS_PRICE_GWEI || '3';

let tokenBuyer: TokenBuyer | null = null;

// Whitelist interface
interface WhitelistEntry {
    creator: string;
}

// JSON file operations

function loadWhitelistFromFile(): WhitelistEntry[] {
    try {
        if (fs.existsSync(WHITELIST_FILE)) {
            const data = fs.readFileSync(WHITELIST_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Error loading whitelist file:', error);
    }
    return [];
}

function isWhitelistedCreator(creator: string): boolean {
    return WHITELIST_CACHE.has(creator.toLowerCase());
}

function initializeWhitelistCache(whitelist: WhitelistEntry[]): void {
    WHITELIST_CACHE.clear();
    whitelist.forEach(entry => {
        WHITELIST_CACHE.add(entry.creator.toLowerCase());
    });
    console.log(`🚀 Whitelist cache initialized with ${WHITELIST_CACHE.size} addresses`);
}

function cleanupProcessedTxs(): void {
    if (processedTxs.size > config.maxProcessedTxs) {
        // Keep only the most recent transactions
        const txArray = Array.from(processedTxs);
        processedTxs.clear();
        // Keep the last 50% of transactions
        const keepCount = Math.floor(config.maxProcessedTxs / 2);
        txArray.slice(-keepCount).forEach(tx => processedTxs.add(tx));
        console.log(`🧹 Cleaned up processed transactions cache (kept ${processedTxs.size} recent txs)`);
    }
}

// Whitelisted tokens file path
const WHITELISTED_TOKENS_FILE = path.join(__dirname, 'list', 'whitelisted_tokens.json');

function saveWhitelistedTokenToFile(tokenMint: TokenMint): void {
    try {
        // Load existing whitelisted tokens
        let existingWhitelistedTokens: TokenMint[] = [];
        if (fs.existsSync(WHITELISTED_TOKENS_FILE)) {
            const data = fs.readFileSync(WHITELISTED_TOKENS_FILE, 'utf8');
            if (data.trim()) {
                existingWhitelistedTokens = JSON.parse(data);
            }
        }

        // Add new whitelisted token
        existingWhitelistedTokens.push(tokenMint);

        // Sort by timestamp (newest first)
        existingWhitelistedTokens.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Save to file
        fs.writeFileSync(WHITELISTED_TOKENS_FILE, JSON.stringify(existingWhitelistedTokens, null, 2));
        console.log(`💾 Whitelisted token saved to ${WHITELISTED_TOKENS_FILE}`);
    } catch (error) {
        console.error('❌ Error saving whitelisted token:', error);
    }
}



async function main() {
    try {
        console.log('🔍 Connecting to BSC Mainnet WebSocket...');

        // Initialize whitelisted tokens file if it doesn't exist
        if (!fs.existsSync(WHITELISTED_TOKENS_FILE)) {
            fs.writeFileSync(WHITELISTED_TOKENS_FILE, JSON.stringify([], null, 2));
            console.log(`📄 Created whitelisted tokens file: ${WHITELISTED_TOKENS_FILE}`);
        }

        // Load and initialize whitelist cache
        const whitelist = loadWhitelistFromFile();
        initializeWhitelistCache(whitelist);
        if (whitelist.length > 0) {
            console.log('🎯 Whitelisted creators:');
            whitelist.forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.creator}`);
            });
        }

        // Display configuration
        console.log('\n⚙️  Performance Configuration:');
        console.log(`   Max processed TXs: ${config.maxProcessedTxs}`);
        console.log(`   Whitelist cache: ${WHITELIST_CACHE.size} addresses`);

        // Display initial memory usage
        const memoryUsage = getMemoryUsage();
        console.log(`   Initial memory usage: ${memoryUsage.used}MB / ${memoryUsage.total}MB (${memoryUsage.percentage}%)`);

        console.log('\n🚀 Real-time whitelist monitoring enabled!');
        console.log('💡 Only whitelisted tokens will be saved and alerted');

        // Initialize token buyer if auto-buy is enabled
        if (AUTO_BUY_ENABLED) {
            try {
                const buyConfig: Partial<BuyConfig> = {
                    bnbAmount: BUY_AMOUNT_BNB,
                    gasPriceGwei: BUY_GAS_PRICE_GWEI,
                    useHighPriorityGas: true,
                    maxRetries: 2,
                };
                tokenBuyer = new TokenBuyer(buyConfig);
                console.log('\n🤖 AUTO-BUY MODE ENABLED');
                console.log('⚡ Will automatically buy whitelisted tokens!');
            } catch (error: any) {
                console.error('❌ Failed to initialize TokenBuyer:', error.message);
                console.log('💡 Continuing in monitoring-only mode');
            }
        } else {
            console.log('\n📊 Monitoring mode only (auto-buy disabled)');
            console.log('💡 Set AUTO_BUY_ENABLED=true in .env to enable auto-buying');
        }

        // Wait for WebSocket connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test connection first
        const blockNumber = await web3.eth.getBlockNumber();
        console.log(`✅ Connected to BSC Mainnet (Block: ${blockNumber})`);

        // Subscribe to TokenCreate events
        const sub = await web3.eth.subscribe('logs', {
            address: '0x5c952063c7fc8610ffdb798152d69f0b9550762b',
            topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
        });

        console.log('✅ Listening for TokenCreate events on Four.meme contract');
        console.log('🎯 Contract: 0x5c952063c7fc8610ffdb798152d69f0b9550762b');
        console.log('🌐 Network: BSC Mainnet (Real-time WebSocket)');
        console.log('🔗 Endpoint: wss://bsc.publicnode.com');

        sub.on('data', async (log: Log) => {
            try {
                const txHash = log.transactionHash as string;

                // Check if we've already processed this transaction
                if (processedTxs.has(txHash)) {
                    return;
                }
                processedTxs.add(txHash);

                const decoded = web3.eth.abi.decodeLog(
                    eventAbi,
                    (log.data ?? '0x') as string,
                    (log.topics ?? []).slice(1) as string[]
                );

                // Create token mint object
                const tokenMint: TokenMint = {
                    tokenAddress: decoded.token as string,
                    name: decoded.name as string,
                    symbol: decoded.symbol as string,
                    creator: decoded.creator as string,
                    timestamp: new Date().toISOString(),
                    transactionHash: txHash,
                    initialSupply: String(decoded.totalSupply),
                    requestId: String(decoded.requestId),
                    launchTime: String(decoded.launchTime),
                    launchFee: String(decoded.launchFee),
                    blockNumber: Number(log.blockNumber),
                    logIndex: Number(log.logIndex)
                };

                // Check if creator is whitelisted (using cached lookup)
                const creator = decoded.creator as string;
                const isWhitelisted = isWhitelistedCreator(creator);

                // Record token for performance monitoring
                performanceMonitor.recordToken();

                // Cleanup processed transactions periodically
                cleanupProcessedTxs();

                if (isWhitelisted) {
                    // Only save whitelisted tokens and show detailed alert
                    saveWhitelistedTokenToFile(tokenMint);

                    console.log('\n🚨🚨🚨 WHITELISTED CREATOR ALERT! 🚨🚨🚨');
                    console.log('🎯 ✅ WHITELISTED CREATOR DETECTED! 🎯');
                    console.log(`Symbol: ${decoded.symbol}`);
                    console.log(`Name: ${decoded.name}`);
                    console.log(`Address: ${decoded.token}`);
                    console.log(`Creator: ${creator}`);
                    console.log(`TX: ${txHash}`);
                    console.log(`Block: ${log.blockNumber}`);
                    console.log(`Timestamp: ${tokenMint.timestamp}`);
                    console.log('🚨 ALERT: This token was created by a whitelisted address!');
                    console.log('─'.repeat(80));

                    // Auto-buy if enabled
                    if (tokenBuyer && AUTO_BUY_ENABLED) {
                        console.log('\n🤖 AUTO-BUY TRIGGERED!');
                        // Execute buy asynchronously without blocking the listener
                        tokenBuyer.buyToken(decoded.token as string)
                            .then(result => {
                                if (result.success) {
                                    console.log(`\n✅ BUY SUCCESS for ${decoded.symbol}`);
                                    console.log(`   Token: ${decoded.token}`);
                                    console.log(`   TX: ${result.txHash}`);
                                    console.log('─'.repeat(80));
                                } else {
                                    console.error(`\n❌ BUY FAILED for ${decoded.symbol}`);
                                    console.error(`   Token: ${decoded.token}`);
                                    console.error(`   Error: ${result.error}`);
                                    console.log('─'.repeat(80));
                                }
                            })
                            .catch(error => {
                                console.error(`\n❌ BUY ERROR for ${decoded.symbol}:`, error);
                                console.log('─'.repeat(80));
                            });
                    }

                } else {
                    // Just log basic info for non-whitelisted tokens (optional)
                    console.log(`\n📝 Token: ${decoded.symbol} (${decoded.name}) - Creator: ${creator.substring(0, 10)}...`);
                }

                // Report performance stats periodically
                if (performanceMonitor.shouldReport()) {
                    performanceMonitor.report();
                    const memoryUsage = getMemoryUsage();
                    console.log(`   Memory: ${memoryUsage.used}MB / ${memoryUsage.total}MB (${memoryUsage.percentage}%)`);
                }
            } catch (error) {
                console.error('❌ Error decoding log:', error);
            }
        });

        sub.on('error', (err: Error) => {
            console.error('❌ Subscription error:', err);
        });

        // Setup graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down gracefully...');
            console.log('✅ Whitelisted tokens saved. Goodbye!');
            process.exit(0);
        });

        // Keep the process running
        console.log('Press Ctrl+C to stop');

    } catch (error) {
        console.error('❌ Failed to connect:', error);
        console.log('💡 Make sure the WebSocket endpoint is accessible');
        process.exit(1);
    }
}

main().catch(console.error);

