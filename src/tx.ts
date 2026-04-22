import { MsgExecuteContractCompat } from '@injectivelabs/sdk-ts/core/modules'
import { BaseAccount } from '@injectivelabs/sdk-ts/core/accounts'
import { ChainRestAuthApi, ChainRestTendermintApi } from '@injectivelabs/sdk-ts/client/chain'
import {
  createTransaction,
  CosmosTxV1Beta1TxPb,
  BroadcastModeKeplr,
  getTxRawFromTxRawOrDirectSignResponse,
} from '@injectivelabs/sdk-ts/core/tx'
import { getStdFee, DEFAULT_BLOCK_TIMEOUT_HEIGHT, toBigNumber } from '@injectivelabs/utils'
import { TransactionException } from '@injectivelabs/exceptions'
import { CHAIN_ID, REST_URL } from './wallet'

const NEPTUNE_CONTRACT = 'inj1nc7gjkf2mhp34a6gquhurg8qahnw5kxs5u3s4u'

// ── Keplr helpers ─────────────────────────────────────────────────────────────

const getKeplr = async () => {
  if (!window.keplr) throw new Error('Keplr extension not installed')
  await window.keplr.enable(CHAIN_ID)
  const offlineSigner = window.keplr.getOfflineSigner(CHAIN_ID)
  const accounts = await offlineSigner.getAccounts()
  const key = await window.keplr.getKey(CHAIN_ID)
  return { offlineSigner, accounts, key }
}

const broadcastTx = async (txRaw: ReturnType<typeof getTxRawFromTxRawOrDirectSignResponse>): Promise<string> => {
  const result = await window.keplr!.sendTx(
    CHAIN_ID,
    CosmosTxV1Beta1TxPb.TxRaw.toBinary(txRaw),
    BroadcastModeKeplr.Sync,
  )

  if (!result || result.length === 0) {
    throw new TransactionException(
      new Error('Transaction failed to be broadcasted'),
      { contextModule: 'Keplr' },
    )
  }

  return Array.from(result, b => b.toString(16).padStart(2, '0')).join('')
}

// ── Core sign + broadcast ─────────────────────────────────────────────────────

async function signAndBroadcast(msg: MsgExecuteContractCompat): Promise<string> {
  const { key, offlineSigner } = await getKeplr()
  const pubKey = btoa(String.fromCharCode(...key.pubKey))
  const injectiveAddress = key.bech32Address

  // Account details
  const chainRestAuthApi = new ChainRestAuthApi(REST_URL)
  const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injectiveAddress)
  const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse)

  // Block details (for timeout height)
  const chainRestTendermintApi = new ChainRestTendermintApi(REST_URL)
  const latestBlock = await chainRestTendermintApi.fetchLatestBlock()
  const latestHeight = latestBlock.header.height
  const timeoutHeight = toBigNumber(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT)

  // Build + sign tx
  const { signDoc } = createTransaction({
    pubKey,
    chainId: CHAIN_ID,
    fee: getStdFee({}),
    message: msg,
    sequence: baseAccount.sequence,
    timeoutHeight: timeoutHeight.toNumber(),
    accountNumber: baseAccount.accountNumber,
  })

  const directSignResponse = await offlineSigner.signDirect(
    injectiveAddress,
    signDoc as Parameters<typeof offlineSigner.signDirect>[1],
  )

  const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse)
  return broadcastTx(txRaw)
}

// ── Deposit collateral ────────────────────────────────────────────────────────

export interface DepositParams {
  senderAddress: string
  collateralDenom: string
  collateralGroup: 'native' | 'token'
  collateralAmount: string
  accountIndex?: number
}

export async function executeDeposit(params: DepositParams): Promise<string> {
  const { senderAddress, collateralDenom, collateralGroup, collateralAmount, accountIndex = 0 } = params

  let msg: MsgExecuteContractCompat

  if (collateralGroup === 'native') {
    msg = MsgExecuteContractCompat.fromJSON({
      contractAddress: NEPTUNE_CONTRACT,
      sender: senderAddress,
      msg: { deposit_collateral: { account_index: accountIndex } },
      funds: [{ denom: collateralDenom, amount: collateralAmount }],
    })
  } else {
    const innerMsg = btoa(JSON.stringify({ deposit_collateral: { account_index: accountIndex } }))
    msg = MsgExecuteContractCompat.fromJSON({
      contractAddress: collateralDenom,
      sender: senderAddress,
      msg: { send: { amount: collateralAmount, contract: NEPTUNE_CONTRACT, msg: innerMsg } },
      funds: [],
    })
  }

  return signAndBroadcast(msg)
}

// ── Borrow ────────────────────────────────────────────────────────────────────

export interface BorrowParams {
  senderAddress: string
  borrowDenom: string
  borrowGroup: 'native' | 'token'
  borrowAmount: string
  accountIndex?: number
}

export async function executeBorrow(params: BorrowParams): Promise<string> {
  const { senderAddress, borrowDenom, borrowGroup, borrowAmount, accountIndex = 0 } = params

  const assetInfo =
    borrowGroup === 'native'
      ? { native_token: { denom: borrowDenom } }
      : { token: { contract_addr: borrowDenom } }

  const msg = MsgExecuteContractCompat.fromJSON({
    contractAddress: NEPTUNE_CONTRACT,
    sender: senderAddress,
    msg: {
      borrow: {
        account_index: accountIndex,
        amount: borrowAmount,
        asset_info: assetInfo,
      },
    },
  })

  return signAndBroadcast(msg)
}
