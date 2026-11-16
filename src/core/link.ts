// The QR the PC shows: puntero://pair?v=1&id=<pc id>&n=<name>&p=<port>&h=<ip>,<ip>&k=<64 hex>
import { fromHex } from './box'

export interface PairLink {
  id: string
  name: string
  port: number
  hosts: string[]
  secret: Uint8Array
}

export const PROTOCOL = 1
export const DEFAULT_PORT = 47810
/**
 * Where the PC app listens: the usual port or, when Windows has it reserved (Hyper-V, WSL and Docker
 * reserve blocks of thousands of ports at startup), one of these two. The same list as PORTS in the PC
 * app's state.rs. Any other port only arrives in the QR.
 */
export const PORTS = [DEFAULT_PORT, 27810, 37810]

/** The port known for a PC first, then the usual ones (the PC may have had to move). */
export function portsFor(port: number): number[] {
  return [...new Set([port, ...PORTS])]
}

export function parsePairLink(text: string): PairLink | null {
  const m = /^puntero:\/\/pair\?(.*)$/i.exec(text.trim())
  if (!m) return null
  const params: Record<string, string> = {}
  for (const part of m[1].split('&')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    try { params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' ')) } catch { return null }
  }
  if (Number(params.v) > PROTOCOL) return null
  const secret = fromHex(params.k ?? '')
  const port = Number(params.p)
  const hosts = (params.h ?? '').split(',').map(h => h.trim()).filter(h => /^[\w.:-]+$/.test(h))
  if (!secret || secret.length !== 32 || !params.id || !Number.isInteger(port) || port <= 0 || port > 65535 || !hosts.length) return null
  return { id: params.id, name: params.n || 'PC', port, hosts, secret }
}
