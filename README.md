# nept.borrow

Borrow against your collateral on [Neptune Finance](https://nept.finance) — live rates, real transactions.

## Features

- **Position preview** — pick collateral + borrow asset, enter amounts, see health factor, LTV, liquidation price, and interest cost in real time
- **On-chain execution** — connect Keplr and go from simulation to actual borrow in two signed transactions (deposit collateral → borrow)
- **Live data** — prices and rates pulled directly from the Neptune Finance API

## Stack

- React + TypeScript + Vite
- [`@injectivelabs/sdk-ts`](https://github.com/InjectiveLabs/injective-ts) for transaction signing and broadcasting
- Keplr wallet via `window.keplr` (no wallet adapter dependency)
- Neptune Finance API (`api-v2.nept.finance/api/v1`)

## Getting started

```bash
npm install
npm run dev
```

Requires Keplr browser extension with an Injective mainnet account.

## Network

| | |
|---|---|
| Chain | Injective mainnet (`injective-1`) |
| Contract | `inj1nc7gjkf2mhp34a6gquhurg8qahnw5kxs5u3s4u` |
| Explorer | [explorer.injective.network](https://explorer.injective.network) |
