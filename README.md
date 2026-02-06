# Four.meme Sniper bot | Four.meme migration sniper bot

BNB four.meme sniper bot that snipes on 0 blocok by using BlockRazor.

## Features

- Real-time token mint detection via WebSocket
- Whitelist-based filtering for specific creators
- **Automatic token buying** with optimized gas settings
- Performance-optimized for speed (nonce caching, gas optimization)
- Comprehensive error handling and retry logic
- TypeScript support with full type safety
- Production-ready with graceful shutdown
- Memory management for long-running operations

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file with the following variables:

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

### Configuration Options

**Auto-Buy Settings:**
- `AUTO_BUY_ENABLED`: Enable/disable automatic token purchasing
- `BUY_AMOUNT_BNB`: BNB amount to spend per token (e.g., "0.001")
- `BUY_GAS_PRICE_GWEI`: Gas price for transactions (higher = faster)

**Performance Settings:**
- `default`: Up to 1,000 tokens/hour
- `high`: Up to 10,000 tokens/hour
- `ultra`: 10,000+ tokens/hour

**⚠️ Security Warning:** Never commit your `.env` file or share your private key!

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## How it Works

The listener connects to BSC WebSocket and subscribes to logs from the Four.meme contract (`0x5c952063c7fc8610ffdb798152d69f0b9550762b`). When a new token is minted, it:

1. Decodes the event data using the TokenCreate ABI
2. Extracts token information (name, symbol, address, creator, etc.)
3. Checks if the creator is in your whitelist
4. If whitelisted:
   - Saves token data to `whitelisted_tokens.json`
   - **Automatically buys the token** (if enabled)
   - Logs detailed alert with purchase confirmation
5. Uses optimized gas settings and nonce caching for fastest execution

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

## Whitelist Configuration

Add creator addresses to `src/list/whitelist.json`:

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

## Performance Optimizations

The system includes several optimizations for speed:

### 🚀 Speed Features

1. **Nonce Caching**: Caches transaction nonce for 5 seconds to avoid RPC delays
2. **Dynamic Gas Pricing**: Automatically boosts gas by 20% for faster inclusion
3. **Asynchronous Buying**: Purchases don't block the event listener
4. **HTTP RPC for Buying**: Uses faster HTTP endpoint for transaction submission
5. **WebSocket for Monitoring**: Uses WebSocket for real-time event detection
6. **Retry Logic**: Automatic retry with exponential backoff

### ⚡ Typical Execution Times

- Event detection: ~100-500ms (WebSocket)
- Transaction submission: ~200-800ms
- **Total time to buy: ~0.3-1.3 seconds from event detection**

### 🎯 Gas Price Strategy

- Monitors current network gas price
- Adds 20% boost for priority
- Uses higher of: configured gas or boosted network gas
- Default: 3 Gwei (fast and economical)

## Architecture

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

## Customization

### Adjust Buy Configuration

Modify buy settings in `.env` or programmatically:

```typescript
// In src/index.ts, you can customize:
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
