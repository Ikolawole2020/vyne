"""Top-level coin id -> base symbol mapping used to build USDT markets."""
COIN_MAP = {
    "bitcoin": "BTC", "ethereum": "ETH", "binancecoin": "BNB", "solana": "SOL",
    "ripple": "XRP", "cardano": "ADA", "dogecoin": "DOGE", "tron": "TRX",
    "avalanche-2": "AVAX", "chainlink": "LINK", "stellar": "XLM", "polkadot": "DOT",
    "toncoin": "TON", "shiba-inu": "SHIB", "litecoin": "LTC", "uniswap": "UNI",
    "near": "NEAR", "internet-computer": "ICP", "aptos": "APT", "cosmos": "ATOM",
    "ethereum-classic": "ETC", "filecoin": "FIL", "hedera-hashgraph": "HBAR",
    "arbitrum": "ARB", "optimism": "OP", "vechain": "VET", "injective-protocol": "INJ",
    "sui": "SUI", "render-token": "RENDER", "sei-network": "SEI", "quant-network": "QNT",
    "celestia": "TIA", "thorchain": "RUNE", "algorand": "ALGO", "aave": "AAVE",
    "maker": "MKR", "the-graph": "GRT", "fantom": "FTM", "sandbox": "SAND",
    "axie-infinity": "AXS", "decentraland": "MANA", "eos": "EOS", "flow": "FLOW",
    "theta-token": "THETA", "neo": "NEO", "kucoin-shares": "KCS", "iota": "IOTA",
    "stacks": "STX", "conflux-token": "CFX", "dash": "DASH", "zilliqa": "ZIL",
    "compound-governance-token": "COMP", "1inch": "1INCH", "curve-dao-token": "CRV",
    "mina-protocol": "MINA", "tezos": "XTZ", "nem": "XEM", "qtum": "QTUM",
    "ontology": "ONT", "pancakeswap-token": "CAKE", "enjincoin": "ENJ",
    "chiliz": "CHZ", "havven": "HVN", "polygon-ecosystem-token": "POL",
    "bitget-token": "BGB", "kava": "KAVA", "gala": "GALA", "flare-networks": "FLR",
    "lido-dao": "LDO", "notcoin": "NOT", "jupiter-exchange-solana": "JUP",
    "bonk": "BONK", "dogwifcoin": "WIF", "pepe": "PEPE", "arweave": "AR",
    "immutable-x": "IMX", "mantle": "MNT", "starknet": "STRK", "worldcoin-wld": "WLD",
    "ethena": "ENA", "bittensor": "TAO", "safe": "SAFE", "kaspa": "KAS",
    "monero": "XMR", "zcash": "ZEC", "bitcoin-cash": "BCH", "rocket-pool": "RPL",
    "ethena-usde": "USDE", "the-open-network": "TON", "jito-staked-sol": "JITOSOL",
    "binance-staked-sol": "BSOL", "wrapped-bitcoin": "WBTC", "tether": "USDT",
    "usd-coin": "USDC", "dai": "DAI", "first-digital-usd": "FDUSD",
    "true-usd": "TUSD", "paypal-usd": "PYUSD", "ethx": "ETHX", "usual": "USUAL",
    "pendle": "PENDLE", "morpho": "MORPHO", "hyperliquid": "HYPE", "sky": "SKY",
    "aerodrome-finance": "AERO", "eigenlayer": "EIGEN", "layerzero": "ZRO",
    "sonic-3": "S", "celer-network": "CELR", "ankr": "ANKR", "harmony": "ONE",
    "linea": "LINEA", "scroll": "SCR", "zksync": "ZK", "mantle-2": "MNT",
    "fartcoin": "FARTCOIN", "book-of-meme": "BOME", "cat-in-a-dogs-world": "MEW",
    "turbo": "TURBO", "spx6900": "SPX", "popcat": "POPCAT", "official-trump": "TRUMP",
    "movement-2": "MOV", "virtual-protocol": "VIRTUAL", "pudgy-penguins": "PENGU",
    "walrus": "WAL", "bittensor-2": "TAO", "staked-ether": "STETH",
    "cryptonex": "CNX", "algoblade": "ALB", "kite": "KITE", "plasma": "XPL",
}

# Stablecoins are never listed as a base pair against USDT.
SKIP_BASES = {
    "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "USDS", "PYUSD",
    "EURT", "GHO", "FRAX", "USDB", "BUSD", "SUSD", "USDF",
}

# Wrapped, staked and derivative tokens duplicate their underlying asset.
SKIP_DERIVATIVES = {
    "WBTC", "STETH", "WSTETH", "JITOSOL", "BNSOL", "BSOL", "SETH", "WBETH",
    "WEETH", "EZETH", "RSETH", "CBETH", "METH", "BTCB", "BTCBLK",
}
