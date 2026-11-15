// What the app remembers (AsyncStorage): this phone's identity, the paired PCs and the settings.
// A tiny store: one object, listeners, saved a moment after each change.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { AirSettings, DEFAULT_AIR } from './core/air'
import { Identity, Pc } from './core/client'
import { DEFAULT_PAD, PadSettings } from './core/touchpad'
import { randomBytes } from './core/box'

export interface Favorite { name: string; url: string }

export interface Settings {
  pad: PadSettings
  air: AirSettings
  /** in air mode, the pointer moves only while a finger rests on the pad (like holding a laser pointer's button) */
  airHold: boolean
  haptics: boolean
  keepAwake: boolean
  /** on opening the app, go straight to the last PC used if it is on the network */
  autoConnect: boolean
  showButtons: boolean
  favorites: Favorite[]
  recentUrls: string[]
  /** app ids pinned to the top of the Apps list */
  pinnedApps: string[]
}

export interface Data {
  identity: Identity
  pcs: Pc[]
  /** the last PC controlled (kept after disconnecting: it is the one the app reconnects to on opening) */
  lastPc: string | null
  settings: Settings
}

export const DEFAULT_FAVORITES: Favorite[] = [
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Netflix', url: 'https://www.netflix.com' },
  { name: 'Prime Video', url: 'https://www.primevideo.com' },
  { name: 'Disney+', url: 'https://www.disneyplus.com' },
  { name: 'Twitch', url: 'https://www.twitch.tv' },
  { name: 'Google', url: 'https://www.google.com' },
]

const DEFAULT_SETTINGS: Settings = {
  pad: DEFAULT_PAD,
  air: DEFAULT_AIR,
  airHold: true,
  haptics: true,
  keepAwake: true,
  autoConnect: true,
  showButtons: true,
  favorites: DEFAULT_FAVORITES,
  recentUrls: [],
  pinnedApps: [],
}

const KEY = 'puntero:data:v1'

function deviceName(): string {
  const c = (Platform.constants ?? {}) as { Brand?: string; Model?: string; Manufacturer?: string }
  const brand = c.Brand ? c.Brand.charAt(0).toUpperCase() + c.Brand.slice(1) : ''
  const model = c.Model ?? ''
  const name = model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`.trim()
  return name || 'Móvil'
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

let data: Data | null = null
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null

export async function loadStore(): Promise<Data> {
  let saved: Partial<Data> = {}
  try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') } catch {}
  const settings = { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }
  settings.pad = { ...DEFAULT_PAD, ...(saved.settings?.pad ?? {}) }
  settings.air = { ...DEFAULT_AIR, ...(saved.settings?.air ?? {}) }
  data = {
    identity: saved.identity ?? { id: hex(randomBytes(12)), name: deviceName() },
    pcs: saved.pcs ?? [],
    lastPc: saved.lastPc ?? null,
    settings,
  }
  if (!saved.identity) persist()
  emit()
  return data
}

function emit() { for (const l of listeners) l() }

function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { if (data) AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {}) }, 300)
}

export function getData(): Data {
  if (!data) throw new Error('store not loaded')
  return data
}

export function update(fn: (d: Data) => Data) {
  data = fn(getData())
  emit()
  persist()
}

export function updateSettings(patch: Partial<Settings>) {
  update(d => ({ ...d, settings: { ...d.settings, ...patch } }))
}

export function savePc(pc: Pc) {
  update(d => ({ ...d, pcs: [pc, ...d.pcs.filter(p => p.id !== pc.id)], lastPc: pc.id }))
}

export function forgetPc(id: string) {
  update(d => ({ ...d, pcs: d.pcs.filter(p => p.id !== id), lastPc: d.lastPc === id ? null : d.lastPc }))
}

export function useData(): Data {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => getData(),
  )
}
