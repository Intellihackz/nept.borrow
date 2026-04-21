export interface CollateralAsset {
  id: string          // asset.id — used as price map key
  symbol: string
  name: string
  decimals: number    // decimals_denom
  maxLtv: number      // config.allowable_ltv
  liquidationLtv: number  // config.liquidation_ltv
}

export interface BorrowMarket {
  id: string          // asset.id — used as price map key
  symbol: string
  name: string
  decimals: number
  borrowApr: number   // rate.apr
  availableLiquidity: number  // state.balance / 10^decimals (display units)
}

// asset.id -> USD price per display unit (e.g. 1 INJ = $3.27)
export type PriceMap = Record<string, number>

export interface SimResult {
  collateralValueUsd: number
  borrowValueUsd: number
  maxBorrowUsd: number
  maxBorrowAmount: number
  currentLtv: number
  maxLtv: number
  liquidationLtv: number
  healthFactor: number
  liquidationPrice: number
  borrowApr: number
  dailyCostUsd: number
  monthlyCostUsd: number
  yearlyCostUsd: number
}
