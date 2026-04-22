import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export const CHAIN_ID = 'injective-1'
export const REST_URL = 'https://sentry.lcd.injective.network'

// ── Keplr window types ────────────────────────────────────────────────────────

interface KeplrKey {
  bech32Address: string
  pubKey: Uint8Array
}

interface KeplrOfflineSigner {
  getAccounts: () => Promise<{ address: string; pubkey: Uint8Array }[]>
  signDirect: (address: string, signDoc: unknown) => Promise<{
    signed: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array; chainId: string; accountNumber: bigint }
    signature: { signature: string; pub_key: { type: string; value: string } }
  }>
}

declare global {
  interface Window {
    keplr?: {
      enable: (chainId: string) => Promise<void>
      getOfflineSigner: (chainId: string) => KeplrOfflineSigner
      getKey: (chainId: string) => Promise<KeplrKey>
      sendTx: (chainId: string, tx: Uint8Array, mode: string) => Promise<Uint8Array>
    }
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface WalletState {
  address: string | null
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletState>({
  address: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const connect = useCallback(async () => {
    if (!window.keplr) {
      alert('Keplr extension not installed. Get it at keplr.app')
      return
    }
    setConnecting(true)
    try {
      await window.keplr.enable(CHAIN_ID)
      const key = await window.keplr.getKey(CHAIN_ID)
      setAddress(key.bech32Address)
    } catch (e) {
      console.error('Keplr connect failed:', e)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => setAddress(null), [])

  return (
    <WalletContext.Provider value={{ address, connecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
