# Neptune Borrow Simulator

A calculator-style tool for simulating borrow positions on [Neptune Finance](https://neptune.finance) — no wallet, no transactions, just math on live market data.

**"What if I borrow X against Y collateral?"**

## What it does

- Pick a collateral asset and enter an amount
- Pick a borrow asset and enter an amount (or hit MAX)
- See live: health factor, LTV, liquidation price, max safe borrow, and interest cost

## What it doesn't do

- No wallet connect
- No transactions
- No address lookup

## Stack

- React + TypeScript + Vite
- Plain CSS (Neptune dark theme)
- Live data from `api-v2.nept.finance/api/v1`

## Endpoints

| Endpoint | Used for |
|---|---|
| `/markets/borrow/collaterals` | Collateral assets + LTV params |
| `/markets/borrow/debts` | Borrow markets + APR |
| `/assets/prices` | USD prices |

## Run locally

```bash
npm install
npm run dev
```
