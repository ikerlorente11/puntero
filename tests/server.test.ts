// End to end against the real PC app (a debug build of pc-toolkit/tools/puntero/app), run by hand:
//   PUNTERO_DEV_LINK=<file> target/debug/el-puntero.exe --hidden   (on the PC)
//   PUNTERO_DEV_LINK=<file> npx vitest run tests/server.test.ts
// It pairs, reconnects as a paired phone, moves the pointer a little (and puts it back), reads the
// volume, the open windows and the apps, and pings. It types nothing and presses no keys.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Connection, pair, Pc, ServerEvent } from '../src/core/client'
import { parsePairLink, PORTS } from '../src/core/link'
import { findPc, probe } from '../src/core/scan'
import { randomBytes, seal, toB64 } from '../src/core/box'

const linkFile = process.env.PUNTERO_DEV_LINK
const identity = { id: 'test-' + Date.now(), name: 'Vitest' }

const waitFor = <T>(fn: () => T | undefined, ms = 5000) => new Promise<T>((resolve, reject) => {
  const start = Date.now()
  const tick = () => {
    const v = fn()
    if (v !== undefined) return resolve(v)
    if (Date.now() - start > ms) return reject(new Error('timeout'))
    setTimeout(tick, 30)
  }
  tick()
})

describe.skipIf(!linkFile)('against the PC app', () => {
  let pc: Pc

  it('is found by /info', async () => {
    const link = parsePairLink(readFileSync(linkFile!, 'utf8'))!
    const found = await probe(fetch as any, '127.0.0.1', link.port)
    expect(found).toMatchObject({ id: link.id, pairing: true })
  })

  it('refuses a wrong code and a wrong QR key', async () => {
    const link = parsePairLink(readFileSync(linkFile!, 'utf8'))!
    await expect(pair(WebSocket as any, identity, link, { via: 'qr', key: randomBytes(32) })).rejects.toThrow(/caducado/)
  })

  it('pairs with the QR', async () => {
    const link = parsePairLink(readFileSync(linkFile!, 'utf8'))!
    pc = await pair(WebSocket as any, identity, link, { via: 'qr', key: link.secret })
    expect(pc.id).toBe(link.id)
    expect(pc.lastHost).toBe('127.0.0.1')
  })

  it('refuses an unknown phone and a forged hello', async () => {
    const stranger = { ...pc, key: toB64(randomBytes(32)) }
    const events: string[] = []
    const c = new Connection(WebSocket as any, { id: 'nobody', name: 'x' }, stranger, { status: (s, e) => events.push(`${s}:${e}`), event: () => {} })
    await waitFor(() => (c.status === 'failed' ? true : undefined))
    expect(c.error).toMatch(/reconoce/)
    c.close()
    // the right id with the wrong key is refused the same way
    const forged = new Connection(WebSocket as any, identity, stranger, { status: () => {}, event: () => {} })
    await waitFor(() => (forged.status === 'failed' ? true : undefined))
    forged.close()
    void seal
  })

  it('finds the PC on its port when the phone remembers another one', async () => {
    const stale = { ...pc, port: PORTS.find(p => p !== pc.port)! }
    expect(await findPc(fetch as any, stale)).toEqual({ host: '127.0.0.1', port: pc.port })
    let moved: Pc | null = null
    const c = new Connection(WebSocket as any, identity, stale, { status: () => {}, event: () => {}, pcChanged: changed => { moved = changed } })
    await waitFor(() => (c.status === 'connected' ? true : undefined))
    expect(moved!.port).toBe(pc.port)
    c.close()
  })

  it('controls the PC as a paired phone', async () => {
    const events: ServerEvent[] = []
    const c = new Connection(WebSocket as any, identity, pc, { status: () => {}, event: e => events.push(e) })
    await waitFor(() => (c.status === 'connected' ? true : undefined))
    expect(events[0]).toMatchObject({ t: 'welcome', id: pc.id })

    const vol = await waitFor(() => events.find(e => e.t === 'vol') as Extract<ServerEvent, { t: 'vol' }> | undefined)
    expect(vol.v).toBeGreaterThanOrEqual(0)
    expect(vol.v).toBeLessThanOrEqual(1)

    // a small square and back where it was
    for (const [x, y] of [[40, 0], [0, 40], [-40, 0], [0, -40]]) { c.send({ t: 'm', x, y }); await new Promise(r => setTimeout(r, 30)) }

    c.send({ t: 'windows' })
    const wins = await waitFor(() => events.find(e => e.t === 'windows') as Extract<ServerEvent, { t: 'windows' }> | undefined)
    expect(Array.isArray(wins.items)).toBe(true)

    c.send({ t: 'apps' })
    const apps = await waitFor(() => events.find(e => e.t === 'apps') as Extract<ServerEvent, { t: 'apps' }> | undefined, 20000)
    expect(apps.items.length).toBeGreaterThan(5)

    c.send({ t: 'ping', n: Date.now() })
    await waitFor(() => events.find(e => e.t === 'pong'))
    expect(c.latency).not.toBeNull()

    c.send({ t: 'key', k: 'nada' })
    const err = await waitFor(() => events.find(e => e.t === 'error') as Extract<ServerEvent, { t: 'error' }> | undefined)
    expect(err.msg).toMatch(/Tecla desconocida/)
    c.close()
  }, 30000)
})
