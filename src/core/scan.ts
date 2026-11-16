// Finds PCs with El Puntero on the phone's network: asks GET /info on every address of its /24
// (192.168.1.1 … 254), on each of the PC app's ports, many at once with a short timeout. No UDP needed,
// so it works in Expo Go too.
import { portsFor } from './link'

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

/**
 * Asks every address on every port, the usual port first. At most `concurrency` requests at a time
 * (Android's HTTP client queues more than 64, and a queued request would use up its timeout waiting),
 * each one started as soon as another ends.
 */
export async function scan(fetchFn: Fetch, ip: string, ports: number[], onFound: (pc: FoundPc) => void, concurrency = 64): Promise<FoundPc[]> {
  const hosts = subnetHosts(ip)
  const jobs = ports.flatMap(port => hosts.map(host => ({ host, port })))
  const found: FoundPc[] = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { host, port } = jobs[next++]
      const pc = await probe(fetchFn, host, port)
      if (pc && !found.some(f => f.id === pc.id)) { found.push(pc); onFound(pc) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
  return found
}

/**
 * Is this paired PC on the network right now? Asks /info on all its known addresses at once, on its
 * port and on the usual ones (it may have had to move), and answers with the first address and port
 * where that same PC replies.
 */
export function findPc(
  fetchFn: Fetch,
  pc: { id: string; hosts: string[]; port: number; lastHost?: string },
  timeoutMs = 1500,
): Promise<{ host: string; port: number } | null> {
  const hosts = [...new Set(pc.lastHost ? [pc.lastHost, ...pc.hosts] : pc.hosts)]
  const tries = hosts.flatMap(host => portsFor(pc.port).map(port => ({ host, port })))
  if (!tries.length) return Promise.resolve(null)
  return new Promise(resolve => {
    let pending = tries.length
    for (const { host, port } of tries) {
      probe(fetchFn, host, port, timeoutMs).then(found => {
        if (found?.id === pc.id) resolve({ host, port })
        else if (--pending === 0) resolve(null)
      })
    }
  })
}
