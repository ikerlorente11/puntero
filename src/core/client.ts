// The phone's side of the connection to a PC (PROTOCOL.md): finds which of the PC's addresses answers,
// says hello (or pairs), then sends sealed commands and gets sealed events. Reconnects on its own
// while wanted. The WebSocket class is passed in, so the tests run it in Node against the real PC app.
import { codeKey, fromB64, open, randomBytes, seal, toB64 } from './box'
import { PORTS, portsFor } from './link'

export interface Pc {
  id: string
  name: string
  hosts: string[]
  port: number
  /** base64 of this phone's 32-byte key for that PC */
  key: string
  lastHost?: string
}

export interface Identity { id: string; name: string }

export type Command = { t: string; [field: string]: unknown }

export type ServerEvent =
  | { t: 'welcome'; name: string; id: string; version: string; v: number; paired?: boolean }
  | { t: 'vol'; v: number; mute: boolean }
  | { t: 'apps'; items: { id: string; name: string }[] }
  | { t: 'windows'; items: { id: number; title: string; exe: string; active: boolean }[] }
  | { t: 'clip'; s: string }
  | { t: 'pong'; n: number }
  | { t: 'error'; msg: string }

export type Status = 'idle' | 'connecting' | 'connected' | 'failed'

type WS = WebSocket
type WSClass = { new (url: string): WS }

interface Hi { t: 'hi'; app: string; v: number; c: string; name: string; id: string }

const DENIED: Record<string, string> = {
  unknown: 'Este PC ya no reconoce el móvil: vuelve a emparejarlo.',
  closed: 'Abre la ventana de El Puntero en el PC para emparejar.',
  badcode: 'El código no es correcto (o ha cambiado).',
  expired: 'El QR ha caducado: escanéalo otra vez.',
  bad: 'El PC no ha entendido el mensaje. ¿Están las dos apps actualizadas?',
}

export class PuntError extends Error {
  constructor(message: string, readonly why?: string) { super(message) }
}

const asBytes = (data: unknown) => (data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null)

/**
 * Opens a socket to every address on every port at once; the first PC to say hi wins (and must be the
 * right PC).
 */
export function reach(Socket: WSClass, hosts: string[], ports: number[], expectId: string | null, timeoutMs = 3000): Promise<{ ws: WS; hi: Hi; host: string; port: number }> {
  return new Promise((resolve, reject) => {
    const sockets: WS[] = []
    let done = false
    let failures = 0
    const finish = (err?: Error, win?: { ws: WS; hi: Hi; host: string; port: number }) => {
      if (done) return
      done = true
      clearTimeout(timer)
      for (const s of sockets) if (s !== win?.ws) { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close() } catch {} }
      if (win) resolve(win)
      else reject(err)
    }
    const timer = setTimeout(() => finish(new PuntError('El PC no responde. ¿Está encendido, con El Puntero abierto y en la misma wifi?')), timeoutMs)
    const unique = [...new Set(hosts)]
    const tries = unique.flatMap(host => [...new Set(ports)].map(port => ({ host, port })))
    if (!tries.length) return finish(new PuntError('No hay ninguna dirección del PC.'))
    for (const { host, port } of tries) {
      let ws: WS
      try { ws = new Socket(`ws://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}/ws`) } catch { failures++; continue }
      ws.binaryType = 'arraybuffer'
      sockets.push(ws)
      const fail = () => { if (++failures >= tries.length) finish(new PuntError('No se puede conectar con el PC. ¿Está El Puntero abierto en el PC y el móvil en la misma wifi?')) }
      ws.onerror = fail
      ws.onclose = fail
      ws.onmessage = (e: MessageEvent) => {
        if (typeof e.data !== 'string') return
        let hi: Hi
        try { hi = JSON.parse(e.data) } catch { return }
        if (hi.t !== 'hi' || hi.app !== 'puntero') return
        if (expectId && hi.id !== expectId) { ws.onerror = ws.onclose = null; try { ws.close() } catch {}; fail(); return }
        ws.onmessage = ws.onerror = ws.onclose = null
        finish(undefined, { ws, hi, host, port })
      }
    }
    if (failures >= tries.length) finish(new PuntError('No se puede conectar con el PC.'))
  })
}

/** Sends the hello (or pair) and waits for the PC's sealed welcome. */
function greet(ws: WS, hello: object, key: Uint8Array, timeoutMs = 5000): Promise<Extract<ServerEvent, { t: 'welcome' }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); try { ws.close() } catch {}; reject(new PuntError('El PC no contesta al saludo.')) }, timeoutMs)
    const cleanup = () => { clearTimeout(timer); ws.onmessage = ws.onclose = ws.onerror = null }
    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data === 'string') {
        let msg: { t?: string; why?: string } = {}
        try { msg = JSON.parse(e.data) } catch {}
        if (msg.t === 'denied') { cleanup(); reject(new PuntError(DENIED[msg.why ?? ''] ?? 'El PC ha rechazado la conexión.', msg.why)) }
        return
      }
      const bytes = asBytes(e.data)
      const welcome = bytes && open<ServerEvent>(key, bytes)
      cleanup()
      if (welcome?.t === 'welcome') resolve(welcome)
      else { try { ws.close() } catch {}; reject(new PuntError('El PC ha contestado algo que no se entiende.')) }
    }
    ws.onclose = ws.onerror = () => { cleanup(); reject(new PuntError('El PC ha cerrado la conexión.')) }
    ws.send(JSON.stringify(hello))
  })
}

/**
 * Pairs with a PC: with the QR's key (via "qr") or the 6-digit code (via "code"). Makes this phone's
 * own key for that PC and returns the PC to remember. `port` is the one the QR or the scan gave, or
 * null (an address typed by hand) to try the usual ones.
 */
export async function pair(
  Socket: WSClass,
  identity: Identity,
  target: { hosts: string[]; port: number | null; id?: string },
  secret: { via: 'qr'; key: Uint8Array } | { via: 'code'; code: string },
): Promise<Pc> {
  const { ws, hi, host, port } = await reach(Socket, target.hosts, target.port ? [target.port] : PORTS, target.id ?? null)
  const deviceKey = randomBytes(32)
  const pairKey = secret.via === 'qr' ? secret.key : codeKey(secret.code)
  const box = seal(pairKey, { c: hi.c, name: identity.name, key: toB64(deviceKey) })
  const welcome = await greet(ws, { t: 'pair', dev: identity.id, via: secret.via, box: toB64(box) }, deviceKey)
  try { ws.close() } catch {}
  return { id: welcome.id, name: welcome.name, hosts: [host, ...target.hosts.filter(h => h !== host)], port, key: toB64(deviceKey), lastHost: host }
}

export interface ConnectionEvents {
  status(status: Status, error: string | null): void
  event(event: ServerEvent): void
  /** The PC answered at another address or under another name: worth saving. */
  pcChanged?(pc: Pc): void
}

const PING_EVERY = 4000
const DEAD_AFTER = 12000

/** A live connection to one paired PC, reconnecting by itself until closed. */
export class Connection {
  status: Status = 'idle'
  error: string | null = null
  latency: number | null = null
  private ws: WS | null = null
  private key: Uint8Array
  private wanted = true
  private retry = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastHeard = 0

  constructor(private Socket: WSClass, private identity: Identity, public pc: Pc, private on: ConnectionEvents) {
    this.key = fromB64(pc.key)
    this.connect()
  }

  private setStatus(status: Status, error: string | null = null) {
    this.status = status
    this.error = error
    this.on.status(status, error)
  }

  private async connect() {
    if (!this.wanted) return
    this.setStatus('connecting', this.error)
    const hosts = this.pc.lastHost ? [this.pc.lastHost, ...this.pc.hosts] : this.pc.hosts
    try {
      // on its port and on the usual ones: the PC moves when Windows has taken its port
      const { ws, hi, host, port } = await reach(this.Socket, hosts, portsFor(this.pc.port), this.pc.id)
      if (!this.wanted) { ws.close(); return }
      const box = seal(this.key, { c: hi.c, name: this.identity.name })
      const welcome = await greet(ws, { t: 'hello', dev: this.identity.id, box: toB64(box) }, this.key)
      if (!this.wanted) { ws.close(); return }
      this.ws = ws
      this.retry = 0
      this.lastHeard = Date.now()
      ws.onmessage = (e: MessageEvent) => this.receive(e.data)
      ws.onclose = ws.onerror = () => this.lost(ws)
      if (host !== this.pc.lastHost || port !== this.pc.port || welcome.name !== this.pc.name) {
        this.pc = { ...this.pc, lastHost: host, port, name: welcome.name, hosts: [host, ...this.pc.hosts.filter(h => h !== host)] }
        this.on.pcChanged?.(this.pc)
      }
      this.setStatus('connected')
      this.on.event(welcome)
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastHeard > DEAD_AFTER) { this.lost(ws); return }
        this.send({ t: 'ping', n: Date.now() })
      }, PING_EVERY)
    } catch (e) {
      const err = e as PuntError
      // a phone the PC no longer knows will not get better by retrying
      if (err.why === 'unknown') { this.wanted = false; this.setStatus('failed', err.message); return }
      this.scheduleRetry(err.message)
    }
  }

  private scheduleRetry(message: string) {
    if (!this.wanted) return
    this.setStatus('connecting', message)
    const delay = Math.min(500 * 2 ** this.retry++, 5000)
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect() }, delay)
  }

  private receive(data: unknown) {
    const bytes = asBytes(data)
    if (!bytes) return
    const event = open<ServerEvent>(this.key, bytes)
    if (!event) return
    this.lastHeard = Date.now()
    if (event.t === 'pong') this.latency = Date.now() - event.n
    this.on.event(event)
  }

  private lost(ws: WS) {
    if (ws !== this.ws) return
    this.ws = null
    ws.onmessage = ws.onclose = ws.onerror = null
    try { ws.close() } catch {}
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    this.scheduleRetry('Se ha perdido la conexión; reconectando…')
  }

  /** Back from the background, or the user tapped retry: try now instead of waiting. */
  wake() {
    if (this.status === 'connected') return
    this.wanted = true
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.retry = 0
    this.connect()
  }

  send(command: Command): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== 1) return false
    ws.send(seal(this.key, command))
    return true
  }

  close() {
    this.wanted = false
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.pingTimer) clearInterval(this.pingTimer)
    const ws = this.ws
    this.ws = null
    if (ws) { ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close() } catch {} }
    this.setStatus('idle')
  }
}
