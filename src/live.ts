// The connection to the PC being controlled, shared by every screen: its status and what the PC told
// us last (volume, open windows, apps, clipboard).
import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { Command, Connection, Pc, ServerEvent, Status } from './core/client'
import { getData, savePc } from './store'

export interface Live {
  pc: Pc | null
  status: Status
  error: string | null
  latency: number | null
  version: string | null
  vol: { v: number; mute: boolean } | null
  windows: Extract<ServerEvent, { t: 'windows' }>['items'] | null
  apps: Extract<ServerEvent, { t: 'apps' }>['items'] | null
  clip: { s: string; at: number } | null
  /** the PC's last complaint ("Esa ventana ya no está abierta"...) */
  notice: { msg: string; at: number } | null
}

const idle: Live = { pc: null, status: 'idle', error: null, latency: null, version: null, vol: null, windows: null, apps: null, clip: null, notice: null }
let live: Live = idle
let conn: Connection | null = null
const listeners = new Set<() => void>()

function set(patch: Partial<Live>) {
  live = { ...live, ...patch }
  for (const l of listeners) l()
}

function onEvent(e: ServerEvent) {
  switch (e.t) {
    case 'welcome': set({ version: e.version }); break
    case 'vol': set({ vol: { v: e.v, mute: e.mute } }); break
    case 'windows': set({ windows: e.items }); break
    case 'apps': set({ apps: e.items }); break
    case 'clip': set({ clip: { s: e.s, at: Date.now() } }); break
    case 'pong': set({ latency: conn?.latency ?? null }); break
    case 'error': set({ notice: { msg: e.msg, at: Date.now() } }); break
  }
}

export function connectTo(pc: Pc) {
  conn?.close()
  live = { ...idle, pc }
  conn = new Connection(WebSocket as any, getData().identity, pc, {
    status: (status, error) => set({ status, error }),
    event: onEvent,
    pcChanged: changed => { savePc(changed); set({ pc: changed }) },
  })
}

export function disconnect() {
  conn?.close()
  conn = null
  set(idle)
}

export function retry() { conn?.wake() }

export function send(command: Command): boolean {
  return conn?.send(command) ?? false
}

export function useLive(): Live {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => live)
}

// back from the background: reconnect at once instead of waiting for the next retry
AppState.addEventListener('change', state => { if (state === 'active') conn?.wake() })
