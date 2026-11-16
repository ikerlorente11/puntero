import { describe, expect, it } from 'vitest'
import { codeKey, fromB64, open, seal, toB64 } from '../src/core/box'
import { parsePairLink } from '../src/core/link'
import { DEFAULT_PAD, Output, Touchpad, Wheel } from '../src/core/touchpad'
import { diffText, typingCommands } from '../src/core/typing'
import { AirMouse, DEFAULT_AIR } from '../src/core/air'
import { findPc, probe, scan, subnetHosts } from '../src/core/scan'
import { portsFor, PORTS } from '../src/core/link'

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

describe('box', () => {
  it('seals and opens', () => {
    const key = new Uint8Array(32).fill(9)
    expect(open(key, seal(key, { t: 'm', x: 1 }))).toEqual({ t: 'm', x: 1 })
    expect(open(new Uint8Array(32), seal(key, { t: 'm' }))).toBeNull()
  })
  it('opens what the PC seals (same vector as crypto.rs)', () => {
    const frame = new Uint8Array([...new Uint8Array(24).fill(1), ...Buffer.from('0254f01825de81034e55f4adbc235e6c4ab86845', 'hex')])
    // "hola" is not JSON: open() returns null, but the box itself opened (checked through nacl)
    expect(open(new Uint8Array(32).fill(2), frame)).toBeNull()
  })
  it('makes the same code key as the PC', () => {
    expect(hex(codeKey('123456'))).toBe('22cc019b281db5c71e0f88d6fff25213fe93728b06f51a603aa49aaf63ec8292')
  })
  it('base64 round trip', () => {
    const b = new Uint8Array([0, 1, 254, 255, 128])
    expect(fromB64(toB64(b))).toEqual(b)
  })
})

describe('pair link', () => {
  const k = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  it('reads the QR', () => {
    const l = parsePairLink(`puntero://pair?v=1&id=abc&n=PC%20de%20Iker&p=47810&h=192.168.1.10,10.0.0.2&k=${k}`)!
    expect(l.name).toBe('PC de Iker')
    expect(l.hosts).toEqual(['192.168.1.10', '10.0.0.2'])
    expect(l.port).toBe(47810)
    expect(hex(l.secret)).toBe(k)
  })
  it('rejects other QRs', () => {
    expect(parsePairLink('https://example.com')).toBeNull()
    expect(parsePairLink(`puntero://pair?v=1&id=abc&p=47810&h=1.2.3.4&k=00`)).toBeNull()
    expect(parsePairLink(`puntero://pair?v=9&id=abc&p=47810&h=1.2.3.4&k=${k}`)).toBeNull()
    expect(parsePairLink(`puntero://pair?v=1&id=abc&p=47810&h=&k=${k}`)).toBeNull()
  })
})

/** A fake clock: time moves only when the test says. */
function rig(settings = DEFAULT_PAD) {
  let now = 0
  let timers: { at: number; fn: () => void; id: number }[] = []
  let nextId = 0
  const out: Output[] = []
  const clock = {
    now: () => now,
    after(ms: number, fn: () => void) {
      const id = nextId++
      timers.push({ at: now + ms, fn, id })
      return () => { timers = timers.filter(t => t.id !== id) }
    },
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      timers.sort((a, b) => a.at - b.at)
      const next = timers[0]
      if (!next || next.at > end) break
      timers.shift()
      now = next.at
      next.fn()
    }
    now = end
  }
  const pad = new Touchpad({ ...settings }, o => out.push(o), clock)
  return { pad, out, advance, clock, actions: () => out.filter(o => o.t !== 'haptic') }
}

describe('touchpad', () => {
  it('a tap clicks after the double-tap window', () => {
    const r = rig()
    r.pad.down(1, 100, 100); r.advance(80); r.pad.up(1)
    expect(r.actions()).toEqual([])
    r.advance(300)
    expect(r.actions()).toEqual([{ t: 'btn', b: 'left', a: 'click' }])
  })
  it('clicks at once without tap-drag', () => {
    const r = rig({ ...DEFAULT_PAD, tapDrag: false })
    r.pad.down(1, 100, 100); r.advance(80); r.pad.up(1)
    expect(r.actions()).toEqual([{ t: 'btn', b: 'left', a: 'click' }])
  })
  it('tap tap is a double click', () => {
    const r = rig()
    r.pad.down(1, 100, 100); r.advance(60); r.pad.up(1)
    r.advance(100)
    r.pad.down(2, 102, 101); r.advance(60); r.pad.up(2)
    r.advance(500)
    expect(r.actions()).toEqual([{ t: 'btn', b: 'left', a: 'dbl' }])
  })
  it('tap then touch and move drags', () => {
    const r = rig()
    r.pad.down(1, 100, 100); r.advance(60); r.pad.up(1)
    r.advance(100)
    r.pad.down(2, 100, 100)
    for (let i = 1; i <= 5; i++) { r.advance(16); r.pad.move(2, 100 + i * 10, 100) }
    r.pad.up(2)
    const a = r.actions()
    expect(a[0]).toEqual({ t: 'btn', b: 'left', a: 'down' })
    expect(a.at(-1)).toEqual({ t: 'btn', b: 'left', a: 'up' })
    expect(a.filter(o => o.t === 'm').length).toBeGreaterThan(2)
    expect(a.some(o => o.t === 'btn' && o.a === 'click')).toBe(false)
  })
  it('moving is not a click, and faster moves go further', () => {
    const r = rig()
    r.pad.down(1, 0, 0)
    r.advance(16); r.pad.move(1, 10, 0)   // starts moving (past the slop)
    r.advance(16); r.pad.move(1, 12, 0)   // slow: 2 dp in 16 ms
    const slow = (r.out.at(-1) as any).x
    r.advance(16); r.pad.move(1, 52, 0)   // fast: 40 dp in 16 ms
    const fast = (r.out.at(-1) as any).x
    r.pad.up(1); r.advance(500)
    expect(slow / 2).toBeLessThan(fast / 40)
    expect(r.actions().some(o => o.t === 'btn')).toBe(false)
  })
  it('long press grabs until lifting', () => {
    const r = rig()
    r.pad.down(1, 50, 50); r.advance(600)
    expect(r.actions()).toEqual([{ t: 'btn', b: 'left', a: 'down' }])
    r.pad.move(1, 80, 50)
    r.pad.up(1)
    expect(r.actions().at(-1)).toEqual({ t: 'btn', b: 'left', a: 'up' })
  })
  it('two-finger tap is a right click, three is middle', () => {
    const r = rig()
    r.pad.down(1, 50, 50); r.pad.down(2, 90, 50); r.advance(90); r.pad.up(1); r.pad.up(2)
    expect(r.actions()).toEqual([{ t: 'btn', b: 'right', a: 'click' }])
    r.advance(500)
    r.pad.down(1, 50, 50); r.pad.down(2, 90, 50); r.pad.down(3, 130, 50); r.advance(90); r.pad.up(1); r.pad.up(2); r.pad.up(3)
    expect(r.actions().at(-1)).toEqual({ t: 'btn', b: 'middle', a: 'click' })
  })
  it('two fingers scroll with the content (natural) and glide after a flick', () => {
    const r = rig()
    r.pad.down(1, 50, 200); r.pad.down(2, 90, 200)
    for (let i = 1; i <= 6; i++) { r.advance(16); r.pad.move(1, 50, 200 - i * 12); r.pad.move(2, 90, 200 - i * 12) }
    const scrolls = r.actions().filter(o => o.t === 'scroll') as any[]
    expect(scrolls.length).toBeGreaterThan(0)
    // fingers up = page moves up = wheel down (negative)
    expect(scrolls.every(s => s.y <= 0)).toBe(true)
    const before = r.out.length
    r.pad.up(1); r.pad.up(2)
    r.advance(400)
    expect(r.out.length).toBeGreaterThan(before)
    expect(r.actions().some(o => o.t === 'btn')).toBe(false)
    // touching again stops the glide
    r.pad.down(3, 10, 10)
    const stopped = r.out.length
    r.advance(200)
    expect(r.out.length).toBe(stopped)
  })
  it('pinch zooms', () => {
    const r = rig()
    r.pad.down(1, 100, 200); r.pad.down(2, 140, 200)
    for (let i = 1; i <= 8; i++) { r.advance(16); r.pad.move(1, 100 - i * 10, 200); r.pad.move(2, 140 + i * 10, 200) }
    const zooms = r.actions().filter(o => o.t === 'zoom') as any[]
    expect(zooms.length).toBeGreaterThan(0)
    expect(zooms.every(z => z.d > 0)).toBe(true)
    expect(r.actions().some(o => o.t === 'scroll')).toBe(false)
  })
  it('three-finger swipe up is task view, once', () => {
    const r = rig()
    r.pad.down(1, 50, 300); r.pad.down(2, 90, 300); r.pad.down(3, 130, 300)
    for (let i = 1; i <= 10; i++) { r.advance(16); for (const id of [1, 2, 3]) r.pad.move(id, 10 + id * 40, 300 - i * 15) }
    r.pad.up(1); r.pad.up(2); r.pad.up(3)
    expect(r.actions()).toEqual([{ t: 'key', k: 'tab', mods: ['win'] }])
  })
})

describe('wheel strip', () => {
  it('scrolls and taps', () => {
    let tapped = 0
    const out: Output[] = []
    let now = 0
    const w = new Wheel(DEFAULT_PAD, o => out.push(o), { now: () => now, after: () => () => {} }, () => tapped++)
    w.down(100); now += 50; w.up()
    expect(tapped).toBe(1)
    w.down(100); now += 16; w.move(130); now += 16; w.move(160); w.up()
    expect(out.filter(o => o.t === 'scroll').length).toBe(2)
    expect(tapped).toBe(1)
  })
  it('can go the other way round', () => {
    const scrolled = (invertWheel: boolean) => {
      const out: Output[] = []
      let now = 0
      const w = new Wheel({ ...DEFAULT_PAD, invertWheel }, o => out.push(o), { now: () => now, after: () => () => {} })
      w.down(100); now += 16; w.move(130); now += 16; w.move(160)
      return out.filter(o => o.t === 'scroll').map(o => (o as { y: number }).y)
    }
    const normal = scrolled(false)
    expect(normal.every(y => y > 0)).toBe(true)
    expect(scrolled(true)).toEqual(normal.map(y => -y))
  })
})

describe('typing', () => {
  it('diffs like a keyboard', () => {
    expect(diffText('hola', 'hola ')).toEqual({ back: 0, text: ' ' })
    expect(diffText('hola', 'hol')).toEqual({ back: 1, text: '' })
    expect(diffText('teh ', 'the ')).toEqual({ back: 3, text: 'he ' })
    expect(diffText('a😀', 'a')).toEqual({ back: 1, text: '' })
  })
  it('one message for autocorrect', () => {
    expect(typingCommands('teh', 'the')).toEqual([{ t: 'text', s: '\b\bhe' }])
    expect(typingCommands('ab', 'ab')).toEqual([])
  })
})

describe('air mouse', () => {
  it('turning left/right moves sideways whatever the grip', () => {
    // upright phone: gravity along y; turning around the vertical is rotation around y
    const upright = new AirMouse(DEFAULT_AIR)
    upright.accel({ x: 0, y: 9.8, z: 0 })
    for (let i = 0; i < 40; i++) upright.accel({ x: 0, y: 9.8, z: 0 })
    let m = { x: 0, y: 0 }
    for (let i = 0; i < 10; i++) m = upright.gyro({ x: 0, y: 1, z: 0 }, 0.01)
    expect(Math.abs(m.x)).toBeGreaterThan(1)
    expect(Math.abs(m.y)).toBe(0)
    // flat phone: gravity along z; the same turn is now rotation around z
    const flat = new AirMouse(DEFAULT_AIR)
    for (let i = 0; i < 40; i++) flat.accel({ x: 0, y: 0, z: 9.8 })
    for (let i = 0; i < 10; i++) m = flat.gyro({ x: 0, y: 0, z: 1 }, 0.01)
    expect(Math.abs(m.x)).toBeGreaterThan(1)
  })
  it('turning out fast and back slowly lands where it started (no acceleration)', () => {
    const a = new AirMouse({ ...DEFAULT_AIR, accel: 0 })
    for (let i = 0; i < 40; i++) a.accel({ x: 0, y: 9.8, z: 0 })
    let x = 0
    for (let i = 0; i < 30; i++) x += a.gyro({ x: 0, y: 2.0, z: 0 }, 0.01).x    // 0.6 rad out, quickly
    for (let i = 0; i < 300; i++) x += a.gyro({ x: 0, y: -0.2, z: 0 }, 0.01).x  // 0.6 rad back, slowly
    for (let i = 0; i < 20; i++) x += a.gyro({ x: 0, y: 0, z: 0 }, 0.01).x
    expect(Math.abs(x)).toBeLessThan(3)
  })
  it('with a mild acceleration the miss stays small', () => {
    const a = new AirMouse({ ...DEFAULT_AIR, accel: 0.15 })
    for (let i = 0; i < 40; i++) a.accel({ x: 0, y: 9.8, z: 0 })
    let x = 0, out = 0
    for (let i = 0; i < 30; i++) { const m = a.gyro({ x: 0, y: 2.0, z: 0 }, 0.01).x; x += m; out += m }
    for (let i = 0; i < 300; i++) x += a.gyro({ x: 0, y: -0.2, z: 0 }, 0.01).x
    for (let i = 0; i < 20; i++) x += a.gyro({ x: 0, y: 0, z: 0 }, 0.01).x
    expect(Math.abs(x) / Math.abs(out)).toBeLessThan(0.1)
  })
  it('sideways goes further than up and down for the same turn', () => {
    const a = new AirMouse(DEFAULT_AIR)
    for (let i = 0; i < 40; i++) a.accel({ x: 0, y: 9.8, z: 0 })
    let h = 0, v = 0
    for (let i = 0; i < 20; i++) h += a.gyro({ x: 0, y: 0.5, z: 0 }, 0.01).x
    a.reset()
    for (let i = 0; i < 20; i++) v += a.gyro({ x: 0.5, y: 0, z: 0 }, 0.01).y
    expect(Math.abs(h) / Math.abs(v)).toBeCloseTo(1.8, 1)
  })
  it('a hand held still does not drift', () => {
    const a = new AirMouse(DEFAULT_AIR)
    for (let i = 0; i < 20; i++) expect(a.gyro({ x: 0.006, y: -0.008, z: 0.009 }, 0.01)).toEqual({ x: -0, y: -0 })
  })
})

describe('scan', () => {
  it('lists the /24', () => {
    const hosts = subnetHosts('192.168.1.37')
    expect(hosts.length).toBe(253)
    expect(hosts).not.toContain('192.168.1.37')
    expect(subnetHosts('nope')).toEqual([])
  })
  it('recognises El Puntero', async () => {
    const ok = async () => ({ ok: true, json: async () => ({ app: 'puntero', id: 'x', name: 'PC', version: '0.1.0', pairing: true }) })
    const other = async () => ({ ok: true, json: async () => ({ app: 'otra' }) })
    expect(await probe(ok, '1.2.3.4', 47810)).toMatchObject({ id: 'x', host: '1.2.3.4', pairing: true })
    expect(await probe(other, '1.2.3.4', 47810)).toBeNull()
    expect(await probe(async () => { throw new Error('x') }, '1.2.3.4', 47810)).toBeNull()
  })
  it('finds a paired PC at any of its addresses', async () => {
    const at = (host: string, id: string) => async (url: string) => {
      if (!url.includes(`//${host}:`)) throw new Error('nadie')
      return { ok: true, json: async () => ({ app: 'puntero', id, name: 'PC' }) }
    }
    const pc = { id: 'x', hosts: ['10.0.0.2', '10.0.0.3'], port: 47810, lastHost: '10.0.0.2' }
    expect(await findPc(at('10.0.0.3', 'x'), pc)).toEqual({ host: '10.0.0.3', port: 47810 })
    expect(await findPc(at('10.0.0.3', 'otro'), pc)).toBeNull()
    expect(await findPc(at('10.0.0.9', 'x'), pc)).toBeNull()
    expect(await findPc(at('10.0.0.2', 'x'), { ...pc, hosts: [] })).toEqual({ host: '10.0.0.2', port: 47810 })
  })
  it('finds a PC that had to move to another port', async () => {
    const on = (port: number) => async (url: string) => {
      if (!url.endsWith(`:${port}/info`)) throw new Error('nadie')
      return { ok: true, json: async () => ({ app: 'puntero', id: 'x', name: 'PC' }) }
    }
    const pc = { id: 'x', hosts: ['10.0.0.2'], port: 47810 }
    expect(await findPc(on(27810), pc)).toEqual({ host: '10.0.0.2', port: 27810 })
    // a port only the QR knew is still tried first
    expect(await findPc(on(51234), { ...pc, port: 51234 })).toEqual({ host: '10.0.0.2', port: 51234 })
    expect(portsFor(37810)).toEqual([37810, 47810, 27810])
    expect(PORTS[0]).toBe(47810)
  })
  it('scans every port, the usual one first, a few at a time', async () => {
    const asked: string[] = []
    let running = 0, most = 0
    const fetchFn = async (url: string) => {
      asked.push(url)
      most = Math.max(most, ++running)
      await new Promise(r => setTimeout(r, 1))
      running--
      if (url === 'http://10.0.0.7:27810/info') return { ok: true, json: async () => ({ app: 'puntero', id: 'x', name: 'PC' }) }
      throw new Error('nadie')
    }
    const seen: string[] = []
    const found = await scan(fetchFn, '10.0.0.5', PORTS, pc => seen.push(`${pc.host}:${pc.port}`), 16)
    expect(found.map(f => f.port)).toEqual([27810])
    expect(seen).toEqual(['10.0.0.7:27810'])
    expect(asked.length).toBe(253 * 3)
    expect(asked[0]).toBe('http://10.0.0.1:47810/info')
    expect(most).toBeLessThanOrEqual(16)
  })
})
