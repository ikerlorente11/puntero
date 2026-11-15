// A pretend PC for the store screenshots (and for trying the app without a Windows PC): speaks the real
// protocol (PROTOCOL.md) with made-up but believable windows, apps and volume. Pairing: any QR is not
// possible here, so pair with the code 123456 (or connect again: every phone that paired is remembered
// while it runs). Pointer and keys are only logged.
//
//   node scripts/demo-pc.mjs            (port 47810; from an Android emulator the PC is 10.0.2.2)
import http from 'node:http'
import nacl from 'tweetnacl'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 47810)
const NAME = process.env.PC_NAME ?? 'PC del salón'
const ID = 'demo0000salon01'
const CODE = '123456'
const enc = new TextEncoder()
const dec = new TextDecoder()
const codeKey = nacl.hash(enc.encode(`puntero-pair-v1:${CODE}`)).slice(0, 32)
const devices = new Map()   // phone id -> key

let volume = { v: 0.42, mute: false }
let windows = [
  { id: 101, title: 'Netflix - Google Chrome', exe: 'chrome.exe', active: true },
  { id: 102, title: 'Spotify Premium', exe: 'Spotify.exe', active: false },
  { id: 103, title: 'Vacaciones en Asturias 2026 - Fotos', exe: 'Photos.exe', active: false },
  { id: 104, title: 'Presupuesto de la reforma.xlsx - Excel', exe: 'EXCEL.EXE', active: false },
  { id: 105, title: 'Descargas - Explorador de archivos', exe: 'explorer.exe', active: false },
  { id: 106, title: 'Discord', exe: 'Discord.exe', active: false },
  { id: 107, title: 'Steam', exe: 'steam.exe', active: false },
]
const apps = [
  'Calculadora', 'Configuración', 'Discord', 'Disney+', 'Epic Games Launcher', 'Excel', 'Explorador de archivos',
  'Fotos', 'Google Chrome', 'Microsoft Edge', 'Netflix', 'Notas rápidas', 'OBS Studio', 'Outlook', 'Paint',
  'PowerPoint', 'Prime Video', 'Recortes', 'Reloj', 'Spotify', 'Steam', 'Teams', 'Terminal', 'Twitch', 'VLC media player',
  'WhatsApp', 'Word', 'Xbox',
].map((name, i) => ({ id: `demo.app.${i}`, name }))

const toB64 = b => Buffer.from(b).toString('base64')
const fromB64 = s => new Uint8Array(Buffer.from(s, 'base64'))
const seal = (key, value) => {
  const nonce = nacl.randomBytes(24)
  const box = nacl.secretbox(enc.encode(JSON.stringify(value)), nonce, key)
  return Buffer.concat([Buffer.from(nonce), Buffer.from(box)])
}
const open = (key, frame) => {
  const u = new Uint8Array(frame)
  const plain = nacl.secretbox.open(u.subarray(24), u.subarray(0, 24), key)
  return plain ? JSON.parse(dec.decode(plain)) : null
}

const server = http.createServer((req, res) => {
  if (req.url === '/info') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ app: 'puntero', v: 1, id: ID, name: NAME, version: '0.1.0', pairing: true }))
  }
  res.statusCode = 404
  res.end()
})

const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', ws => {
  const c = toB64(nacl.randomBytes(16))
  ws.send(JSON.stringify({ t: 'hi', app: 'puntero', v: 1, c, name: NAME, id: ID }))
  let key = null
  ws.on('message', (data, binary) => {
    if (!key) {
      const hello = JSON.parse(data.toString())
      if (hello.t === 'pair') {
        const inner = open(codeKey, fromB64(hello.box))
        if (!inner || inner.c !== c) return ws.send(JSON.stringify({ t: 'denied', why: 'badcode' }))
        key = fromB64(inner.key)
        devices.set(hello.dev, key)
      } else {
        const known = devices.get(hello.dev)
        const inner = known && open(known, fromB64(hello.box))
        if (!inner || inner.c !== c) return ws.send(JSON.stringify({ t: 'denied', why: 'unknown' }))
        key = known
      }
      const send = e => ws.send(seal(key, e))
      ws.sendEvent = send
      send({ t: 'welcome', name: NAME, id: ID, version: '0.1.0', v: 1, paired: hello.t === 'pair' || undefined })
      send({ t: 'vol', ...volume })
      return
    }
    if (!binary) return
    const cmd = open(key, data)
    if (!cmd) return
    const send = ws.sendEvent
    switch (cmd.t) {
      case 'ping': return send({ t: 'pong', n: cmd.n })
      case 'vol':
        if (typeof cmd.v === 'number') volume.v = cmd.v
        if (typeof cmd.mute === 'boolean') volume.mute = cmd.mute
        return send({ t: 'vol', ...volume })
      case 'windows': return send({ t: 'windows', items: windows })
      case 'win':
        if (cmd.a === 'close') windows = windows.filter(w => w.id !== cmd.id)
        if (cmd.a === 'focus') windows = windows.map(w => ({ ...w, active: w.id === cmd.id }))
        return send({ t: 'windows', items: windows })
      case 'apps': return send({ t: 'apps', items: apps })
      case 'clipget': return send({ t: 'clip', s: 'Reserva: mesa para 4 el sábado a las 21:30' })
      case 'm': return
      default: console.log(cmd)
    }
  })
})

server.listen(PORT, () => console.log(`demo PC «${NAME}» en el puerto ${PORT} (código ${CODE})`))
