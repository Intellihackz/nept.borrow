import { useState, useEffect, useMemo } from 'react'
import { fetchBorrowMarkets, fetchCollaterals, fetchPrices } from './api'
import type { BorrowMarket, CollateralAsset, PriceMap, SimResult } from './types'
import './App.css'

// ── Math ──────────────────────────────────────────────────────────────────────

function computeResult(
  collateral: CollateralAsset | null,
  market: BorrowMarket | null,
  collateralAmount: number,
  borrowAmount: number,
  prices: PriceMap,
): SimResult | null {
  if (!collateral || !market || collateralAmount <= 0) return null

  const collateralPrice = prices[collateral.id] ?? 0
  const borrowPrice = prices[market.id] ?? 0
  if (collateralPrice <= 0 || borrowPrice <= 0) return null

  const collateralValueUsd = collateralAmount * collateralPrice
  const maxBorrowUsd = collateralValueUsd * collateral.maxLtv
  const maxBorrowAmount = maxBorrowUsd / borrowPrice
  const borrowValueUsd = borrowAmount * borrowPrice
  const currentLtv = borrowValueUsd / collateralValueUsd

  const healthFactor =
    borrowValueUsd > 0
      ? (collateralValueUsd * collateral.liquidationLtv) / borrowValueUsd
      : Infinity

  // collateral price at which the position gets liquidated
  const liquidationPrice =
    borrowValueUsd > 0
      ? borrowValueUsd / (collateralAmount * collateral.liquidationLtv)
      : 0

  const yearlyCostUsd = borrowValueUsd * market.borrowApr
  return {
    collateralValueUsd,
    borrowValueUsd,
    maxBorrowUsd,
    maxBorrowAmount,
    currentLtv,
    maxLtv: collateral.maxLtv,
    liquidationLtv: collateral.liquidationLtv,
    healthFactor,
    liquidationPrice,
    borrowApr: market.borrowApr,
    yearlyCostUsd,
    monthlyCostUsd: yearlyCostUsd / 12,
    dailyCostUsd: yearlyCostUsd / 365,
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  if (!isFinite(n)) return '∞'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtUsd(n: number) {
  return '$' + fmt(n, 2)
}

function fmtPct(n: number) {
  return fmt(n * 100, 2) + '%'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBar({ value }: { value: number }) {
  const pct = isFinite(value) ? Math.min((value / 5) * 100, 100) : 100
  const color = value >= 2 ? 'var(--green)' : value >= 1.3 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="health-bar-track">
      <div className="health-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function AssetSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; symbol: string; name: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="asset-select-wrap">
      <label className="field-label">{label}</label>
      <select className="asset-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.symbol} — {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function AmountInput({
  label,
  value,
  onChange,
  hint,
  onMax,
  maxLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  onMax?: () => void
  maxLabel?: string
}) {
  return (
    <div className="amount-input-wrap">
      <div className="amount-input-header">
        <label className="field-label">{label}</label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <div className="amount-input-row">
        <input
          className="amount-input"
          type="number"
          min="0"
          step="any"
          placeholder="0.00"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {onMax && (
          <button className="max-btn" onClick={onMax} type="button">
            {maxLabel ?? 'MAX'}
          </button>
        )}
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  sub,
  highlight,
  warn,
  danger,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  warn?: boolean
  danger?: boolean
}) {
  const cls = ['stat-row', highlight && 'stat-highlight', warn && 'stat-warn', danger && 'stat-danger']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {sub && <span className="stat-sub"> {sub}</span>}
      </span>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [markets, setMarkets] = useState<BorrowMarket[]>([])
  const [collaterals, setCollaterals] = useState<CollateralAsset[]>([])
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [collateralId, setCollateralId] = useState('')
  const [borrowId, setBorrowId] = useState('')
  const [collateralInput, setCollateralInput] = useState('')
  const [borrowInput, setBorrowInput] = useState('')

  useEffect(() => {
    Promise.all([fetchBorrowMarkets(), fetchCollaterals(), fetchPrices()])
      .then(([m, c, p]) => {
        setMarkets(m)
        setCollaterals(c)
        setPrices(p)
        if (c.length) setCollateralId(c[0].id)
        if (m.length) setBorrowId(m[0].id)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const selectedCollateral = collaterals.find(c => c.id === collateralId) ?? null
  const selectedMarket = markets.find(m => m.id === borrowId) ?? null

  const collateralAmount = parseFloat(collateralInput) || 0
  const borrowAmount = parseFloat(borrowInput) || 0

  const result = useMemo(
    () => computeResult(selectedCollateral, selectedMarket, collateralAmount, borrowAmount, prices),
    [selectedCollateral, selectedMarket, collateralAmount, borrowAmount, prices],
  )

  function applyMaxBorrow() {
    if (!result) return
    // 99% of max to leave a safety margin
    setBorrowInput(fmt(result.maxBorrowAmount * 0.99, 6))
  }

  const collateralPrice = selectedCollateral ? (prices[selectedCollateral.id] ?? 0) : 0
  const borrowPrice = selectedMarket ? (prices[selectedMarket.id] ?? 0) : 0

  const ltvPct = result && result.currentLtv > 0 ? result.currentLtv / result.maxLtv : 0
  const hfDanger = !!result && result.healthFactor < 1.1
  const hfWarn = !!result && result.healthFactor >= 1.1 && result.healthFactor < 2
  const hfSafe = !!result && result.healthFactor >= 2

  return (
    <div className="app">
      <main className="sim-main">
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading markets…</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>Failed to load market data. {error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="page-heading">
              <h1>Borrow Simulator</h1>
              <p>What if I borrow X against Y collateral?</p>
            </div>
            <div className="sim-grid">
              {/* ── Inputs ── */}
              <div className="panel panel-inputs">
                <section className="input-section">
                  <h2 className="section-title">
                    <span className="section-num">1</span> Collateral
                  </h2>
                  <AssetSelect
                    label="Asset"
                    options={collaterals}
                    value={collateralId}
                    onChange={v => { setCollateralId(v); setCollateralInput(''); setBorrowInput('') }}
                  />
                  <AmountInput
                    label="Amount"
                    value={collateralInput}
                    onChange={setCollateralInput}
                    hint={collateralPrice > 0 && collateralAmount > 0 ? fmtUsd(collateralAmount * collateralPrice) : undefined}
                  />
                  {selectedCollateral && (
                    <div className="param-pills">
                      <span className="pill">Max LTV {fmtPct(selectedCollateral.maxLtv)}</span>
                      <span className="pill">Liq. at {fmtPct(selectedCollateral.liquidationLtv)}</span>
                      {collateralPrice > 0 && <span className="pill">{fmtUsd(collateralPrice)} / {selectedCollateral.symbol}</span>}
                    </div>
                  )}
                </section>

                <div className="section-divider" />

                <section className="input-section">
                  <h2 className="section-title">
                    <span className="section-num">2</span> Borrow
                  </h2>
                  <AssetSelect
                    label="Asset"
                    options={markets}
                    value={borrowId}
                    onChange={v => { setBorrowId(v); setBorrowInput('') }}
                  />
                  <AmountInput
                    label="Amount"
                    value={borrowInput}
                    onChange={setBorrowInput}
                    hint={borrowPrice > 0 && borrowAmount > 0 ? fmtUsd(borrowAmount * borrowPrice) : undefined}
                    onMax={result ? applyMaxBorrow : undefined}
                    maxLabel={result ? `MAX ${fmt(result.maxBorrowAmount * 0.99, 4)} ${selectedMarket?.symbol}` : 'MAX'}
                  />
                  {selectedMarket && (
                    <div className="param-pills">
                      <span className="pill">APR {fmtPct(selectedMarket.borrowApr)}</span>
                      <span className="pill">
                        Avail. {fmtUsd(selectedMarket.availableLiquidity * (borrowPrice || 1))}
                      </span>
                      {borrowPrice > 0 && <span className="pill">{fmtUsd(borrowPrice)} / {selectedMarket.symbol}</span>}
                    </div>
                  )}
                </section>
              </div>

              {/* ── Results ── */}
              <div className="panel panel-results">
                {!result || collateralAmount === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◈</div>
                    <p>Enter a collateral amount<br />to see your borrow simulation</p>
                  </div>
                ) : (
                  <>
                    <h2 className="results-title">Simulation Results</h2>

                    <div className="results-group">
                      <StatRow
                        label="Collateral value"
                        value={fmtUsd(result.collateralValueUsd)}
                        highlight
                      />
                      <StatRow
                        label="Max you can borrow"
                        value={`${fmt(result.maxBorrowAmount, 4)} ${selectedMarket?.symbol}`}
                        sub={fmtUsd(result.maxBorrowUsd)}
                        highlight
                      />
                    </div>

                    {borrowAmount > 0 && (
                      <>
                        <div className="results-divider" />
                        <div className="results-group">
                          <StatRow
                            label="Loan-to-Value"
                            value={fmtPct(result.currentLtv)}
                            sub={`/ ${fmtPct(result.maxLtv)} max`}
                            warn={ltvPct > 0.75 && ltvPct <= 0.9}
                            danger={ltvPct > 0.9}
                          />
                          <div className="ltv-track">
                            <div
                              className="ltv-fill"
                              style={{
                                width: `${Math.min(ltvPct * 100, 100)}%`,
                                background: ltvPct > 0.9 ? 'var(--red)' : ltvPct > 0.75 ? 'var(--yellow)' : 'var(--accent)',
                              }}
                            />
                          </div>

                          <div className="health-row">
                            <div className="health-label-row">
                              <span className="stat-label">Health Factor</span>
                              <span
                                className="health-value"
                                style={{ color: hfDanger ? 'var(--red)' : hfWarn ? 'var(--yellow)' : 'var(--green)' }}
                              >
                                {isFinite(result.healthFactor) ? fmt(result.healthFactor, 2) : '∞'}
                                <span
                                  className="health-badge"
                                  style={{
                                    background: hfDanger ? 'var(--red-bg)' : hfWarn ? 'var(--yellow-bg)' : 'var(--green-bg)',
                                    color: hfDanger ? 'var(--red)' : hfWarn ? 'var(--yellow)' : 'var(--green)',
                                  }}
                                >
                                  {hfSafe ? 'Safe' : hfWarn ? 'Caution' : 'At Risk'}
                                </span>
                              </span>
                            </div>
                            <HealthBar value={result.healthFactor} />
                          </div>

                          {result.liquidationPrice > 0 && (
                            <StatRow
                              label={`${selectedCollateral?.symbol} liquidation price`}
                              value={fmtUsd(result.liquidationPrice)}
                              sub={`(now ${fmtUsd(collateralPrice)})`}
                              warn={hfWarn}
                              danger={hfDanger}
                            />
                          )}
                        </div>

                        <div className="results-divider" />
                        <div className="results-group">
                          <p className="group-label">Interest at {fmtPct(result.borrowApr)} APR</p>
                          <StatRow label="Per year" value={fmtUsd(result.yearlyCostUsd)} />
                          <StatRow label="Per month" value={fmtUsd(result.monthlyCostUsd)} />
                          <StatRow label="Per day" value={fmtUsd(result.dailyCostUsd)} />
                        </div>
                      </>
                    )}

                    {borrowAmount === 0 && result.maxBorrowAmount > 0 && (
                      <div className="cta-hint">
                        ↑ Enter a borrow amount or tap MAX to see full simulation
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Simulation only — no wallet required. Rates and prices are live from Neptune.</p>
        <a href="https://nept.finance" target="_blank" rel="noopener noreferrer">nept.finance ↗</a>
      </footer>
    </div>
  )
}
