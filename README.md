# Flap Sniper Bot - Fastest Token Sniping on BSC

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![Web3.js](https://img.shields.io/badge/Web3.js-4.3-green)](https://web3js.readthedocs.io/)

**The fastest and most reliable flap sniper bot for Binance Smart Chain (BSC). Automatically detect and buy new tokens from whitelisted creators in under 0.2-0.3 seconds.**

## Consult
For mroe consulting for flap sniper bot
feel free to reach out to me
- [Telegram](https://t.me/roswellecho)

## Why This is the Best flap Sniper Bot

- **Lightning Fast**: 0.3-1.3 second execution time from detection to purchase
- **Real-time Detection**: WebSocket-based event monitoring for instant token detection
- **Auto-Buy**: Fully automated token purchasing with optimized gas settings
- **Whitelist Filtering**: Only buy tokens from trusted creators
- **Performance Optimized**: Nonce caching, gas optimization, and memory management
- **Production Ready**: Comprehensive error handling, retry logic, and graceful shutdown
- **Performance Monitoring**: Built-in stats tracking and memory management
- **Secure**: TypeScript with full type safety

## Key Features

### Real-Time Token Detection
- WebSocket connection to BSC for instant event detection
- Sub-second event processing (~100-500ms)

### Automatic Token Buying
- **Auto-buy enabled/disabled** via environment variable
- Configurable BNB amount per purchase
- Dynamic gas price optimization (20% boost for priority)
- Nonce caching for faster transaction submission
- Retry logic with exponential backoff

### Whitelist System
- Filter tokens by creator addresses
- In-memory caching for instant lookups
- JSON-based configuration
- Automatic token logging for whitelisted creators

### Performance Modes
- **Default**: Up to 1,000 tokens/hour
- **High**: Up to 10,000 tokens/hour  
- **Ultra**: 10,000+ tokens/hour

## Installation

```bash
# Clone the repository
git clone https://github.com/roswelly/bnb-flap-sniper.git
cd bnb-flap-sniper

# Install dependencies
npm install
```

## Configuration

### 1. Environment Variables

Create a `.env` file in the root directory:

```env
# BSC RPC Configuration
RPC_URL=https://bsc-dataseed1.binance.org/

# Wallet Configuration (Required for auto-buy)
PRIVATE_KEY=your_private_key_without_0x_prefix
WALLET_ADDRESS=0xYourWalletAddressHere

# Auto-Buy Configuration
AUTO_BUY_ENABLED=true              # Set to 'true' to enable automatic buying
BUY_AMOUNT_BNB=0.001               # Amount of BNB per purchase
BUY_GAS_PRICE_GWEI=3               # Gas price (3-5 normal, 5-10 high priority)

# Performance Configuration
TOKEN_VOLUME=default               # Options: default, high, ultra
```

### 2. Whitelist Configuration

Edit `src/list/whitelist.json` with creator addresses you want to monitor:

```json
[
  {
    "creator": "0xYourWhitelistedCreatorAddress1"
  },
  {
    "creator": "0xYourWhitelistedCreatorAddress2"
  }
]
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## How It Works

The flap sniper bot works in the following way:

cors is tx parse, submit


### Architecture Flow

```
┌─────────────────────┐
│  BSC WebSocket      │  Real-time event monitoring
│  (Public Node)      │
└──────┬──────────────┘
       │ TokenCreate Event
       ▼
┌─────────────────────┐
│  Event Decoder      │  Parse event data
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Whitelist Check    │  Creator validation (cached)
└──────┬──────────────┘
       │ If whitelisted
       ▼
┌─────────────────────┐
│  Token Buyer        │  Automatic purchase
│  (HTTP RPC)         │  - Nonce caching
└──────┬──────────────┘  - Gas optimization
       │                 - Retry logic
       ▼
┌─────────────────────┐
│  Transaction Sent   │  ⚡ Fast execution
└─────────────────────┘
```
## Token Data Structure

```typescript
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
```

## Configuration Options

### Auto-Buy Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `AUTO_BUY_ENABLED` | `false` | Enable automatic buying |
| `BUY_AMOUNT_BNB` | `0.001` | BNB amount per purchase |
| `BUY_GAS_PRICE_GWEI` | `3` | Gas price (higher = faster) |

### Gas Price Recommendations

- **Normal**: 3-5 Gwei (economical, 3-5 second confirmation)
- **Fast**: 5-8 Gwei (priority, 1-3 second confirmation)
- **Urgent**: 10+ Gwei (highest priority, sub-second confirmation)

### Performance Modes

- **default**: Standard mode for normal usage (10K tx cache)
- **high**: High-volume mode (50K tx cache, 500 batch size)
- **ultra**: Ultra high-volume mode (100K tx cache, 1000 batch size)

## Security Best Practices

1. **Never commit** your `.env` file
2. **Use a dedicated wallet** for trading (not your main wallet)
3. **Start with small amounts** to test (e.g., 0.001 BNB)
4. **Monitor gas prices** on BSCScan before running
5. **Keep sufficient BNB** for gas fees (0.001-0.01 BNB per tx)

## Troubleshooting

### "Missing PRIVATE_KEY in .env"
- Add your private key to `.env` file (without 0x prefix)

### "Missing WALLET_ADDRESS in .env"
- Add your wallet address to `.env` file (with 0x prefix)

### Transactions failing
- Check you have sufficient BNB balance
- Increase `BUY_GAS_PRICE_GWEI` for faster inclusion
- Check BSCScan for network congestion

### No tokens detected
- Verify whitelist addresses are correct (checksummed)
- Check BSC WebSocket connection is stable
- Monitor console for connection status

## Cost Estimation

### Per Transaction
- **Gas fee**: ~0.0005-0.002 BNB (depending on gas price)
- **Buy amount**: Configurable (default 0.001 BNB)
- **Total per buy**: ~0.0015-0.003 BNB

### Example Scenarios
- **10 buys/day** @ 0.002 BNB each = 0.02 BNB/day
- **50 buys/day** @ 0.002 BNB each = 0.1 BNB/day

## Advanced Usage

### Custom Buy Configuration

You can modify buy settings programmatically in `src/index.ts`:

```typescript
const buyConfig: Partial<BuyConfig> = {
    bnbAmount: '0.005',          // Buy with 0.005 BNB
    gasPriceGwei: '5',           // Use 5 Gwei gas
    useHighPriorityGas: true,    // Enable gas boost
    maxRetries: 3,               // Retry up to 3 times
    gasLimit: 600000,            // Higher gas limit
};
```

### Monitor-Only Mode

To disable auto-buy and only monitor:

```env
AUTO_BUY_ENABLED=false
```

## Related Projects

- [Flap platform](https://flap.sh) - Official Flap platform
- [BSCScan](https://bscscan.com) - BSC blockchain explorer
- [Web3.js Documentation](https://web3js.readthedocs.io/) - Web3.js library docs


## Star History

If you find this project useful, please consider giving it a star ⭐ on GitHub!

---

**Keywords**: flap sniper bot, flap sniper, flap bot, bsc sniper bot, token sniper, meme token sniper, auto buy bot, flap auto buy, bsc token sniping, fastest meme sniper, flap trading bot
