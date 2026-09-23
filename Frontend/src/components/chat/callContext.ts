import { createContext, useContext } from 'react'

export type CallKind = 'VOICE' | 'VIDEO'

export interface CallPeer {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

export interface CallContextValue {
  placeCall: (opts: { conversationId: string; kind: CallKind; peer: CallPeer }) => void
  busy: boolean
}

const noopPlaceCall = (_opts: { conversationId: string; kind: CallKind; peer: CallPeer }) => {}

export const CallContext = createContext<CallContextValue>({
  placeCall: noopPlaceCall,
  busy: false,
})

export function useCallApi(): CallContextValue {
  return useContext(CallContext)
}