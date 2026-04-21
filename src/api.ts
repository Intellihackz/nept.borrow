import type { CollateralAsset, BorrowMarket, PriceMap } from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-v2.nept.finance/api/v1'

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface RawAssetInfo {
  asset: { id: string; group: string; group_key: string }
  metadata: { name: string; symbol: string; symbol_denom: string; decimals_denom: number; decimals_display: number }
  classification: unknown
}

interface RawCollateralItem {
  asset_info: RawAssetInfo
  config: { enabled: boolean; allowable_ltv: string; liquidation_ltv: string; [k: string]: unknown }
  state: { balance: string; [k: string]: unknown }
}

interface RawDebtItem {
  asset_info: RawAssetInfo
  rate: { apr: string; apy: string; [k: string]: unknown }
  config: { enabled: boolean; [k: string]: unknown }
  state: { balance: string; [k: string]: unknown }
}

interface RawPriceItem {
  asset: { id: string; [k: string]: unknown }
  metadata: { decimals_denom: number; [k: string]: unknown }
  price: { price: string; [k: string]: unknown }
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseCollaterals(raw: { data: { contents: RawCollateralItem[] } }): CollateralAsset[] {
  return raw.data.contents
    .filter(c => c.config.enabled)
    .map(c => ({
      id: c.asset_info.asset.id,
      symbol: c.asset_info.metadata.symbol,
      name: c.asset_info.metadata.name,
      decimals: c.asset_info.metadata.decimals_denom,
      maxLtv: parseFloat(c.config.allowable_ltv),
      liquidationLtv: parseFloat(c.config.liquidation_ltv),
    }))
}

function parseDebts(raw: { data: { contents: RawDebtItem[] } }): BorrowMarket[] {
  return raw.data.contents
    .filter(d => d.config.enabled)
    .map(d => ({
      id: d.asset_info.asset.id,
      symbol: d.asset_info.metadata.symbol,
      name: d.asset_info.metadata.name,
      decimals: d.asset_info.metadata.decimals_denom,
      borrowApr: parseFloat(d.rate.apr),
      availableLiquidity: parseFloat(d.state.balance) / Math.pow(10, d.asset_info.metadata.decimals_denom),
    }))
}

function parsePrices(raw: { data: RawPriceItem[] }): PriceMap {
  const map: PriceMap = {}
  for (const p of raw.data) {
    map[p.asset.id] = parseFloat(p.price.price)
  }
  return map
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

export async function fetchCollaterals(): Promise<CollateralAsset[]> {
  const raw = await get<{ data: { contents: RawCollateralItem[] } }>('/markets/borrow/collaterals')
  return parseCollaterals(raw)
}

export async function fetchBorrowMarkets(): Promise<BorrowMarket[]> {
  const raw = await get<{ data: { contents: RawDebtItem[] } }>('/markets/borrow/debts')
  return parseDebts(raw)
}

export async function fetchPrices(): Promise<PriceMap> {
  const raw = await get<{ data: RawPriceItem[] }>('/assets/prices')
  return parsePrices(raw)
}
