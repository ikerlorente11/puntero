// Finds PCs with El Puntero on the phone's network: asks GET /info on every address of its /24
// (192.168.1.1 … 254) at once, with a short timeout. No UDP needed, so it works in Expo Go too.

export interface FoundPc { id: string; name: string; host: string; port: number; version: string; pairing: boolean }

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<any> }>

export function subnetHosts(ip: string): string[] {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  if (!m || ip === '0.0.0.0' || ip.startsWith('127.')) return []
  const base = `${m[1]}.${m[2]}.${m[3]}.`
  const out: string[] = []
  for (let i = 1; i < 255; i++) if (String(i) !== m[4]) out.push(base + i)
  return out
}

export async function probe(fetchFn: Fetch, host: string, port: number, timeoutMs = 1200): Promise<FoundPc | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchFn(`http://${host}:${port}/info`, { signal: ctrl.signal })
    if (!res.ok) return null
    const info = await res.json()
    if (info?.app !== 'puntero' || typeof info.id !== 'string') return null
    return { id: info.id, name: String(info.name ?? 'PC'), host, port, version: String(info.version ?? ''), pairing: !!info.pairing }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function scan(fetchFn: Fetch, ip: string, port: number, onFound: (pc: FoundPc) => void, batch = 64): Promise<FoundPc[]> {
  const hosts = subnetHosts(ip)
  const found: FoundPc[] = []
  for (let i = 0; i < hosts.length; i += batch) {
    const results = await Promise.all(hosts.slice(i, i + batch).map(h => probe(fetchFn, h, port)))
    for (const pc of results) {
      if (pc && !found.some(f => f.id === pc.id)) { found.push(pc); onFound(pc) }
    }
  }
  return found
}
