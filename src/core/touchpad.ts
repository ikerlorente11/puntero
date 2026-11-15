// The touchpad: touches in, mouse actions out. Pure logic (time and timers are passed in) so the tests
// can play gestures exactly. Coordinates are in dp.
//
//   1 finger        move (with acceleration: slow is precise, fast crosses the screen)
//   tap             left click (a tap, then touch again and move = drag; tap tap = double click)
//   long press      grab (left button held) until the finger lifts: drag without double-tap tricks
//   2 fingers       scroll (keeps gliding after a flick), pinch = zoom (Ctrl + wheel)
//   2-finger tap    right click
//   3-finger tap    middle click
//   3 fingers swipe ← → switch app (Alt+Tab), ↑ task view, ↓ desktop
//   4 fingers swipe ← → next/previous virtual desktop

export type Output =
  | { t: 'm'; x: number; y: number }
  | { t: 'btn'; b: 'left' | 'right' | 'middle'; a: 'click' | 'down' | 'up' | 'dbl' }
  | { t: 'scroll'; x: number; y: number }
  | { t: 'zoom'; d: number }
  | { t: 'key'; k: string; mods: string[] }
  | { t: 'haptic'; kind: 'light' | 'medium' | 'tick' }

export interface PadSettings {
  /** pointer speed, 0.5..4 */
  speed: number
  /** how much faster quick moves go, 0..1.5 */
  accel: number
  /** wheel units per dp of two-finger scroll */
  scrollSpeed: number
  /** content follows the fingers (like a phone or a Windows touchpad); off = like a mouse wheel */
  naturalScroll: boolean
  tapToClick: boolean
  /** tap then touch-and-move drags (single taps wait a moment for that) */
  tapDrag: boolean
  longPressDrag: boolean
  inertia: boolean
}

export const DEFAULT_PAD: PadSettings = {
  speed: 1.6,
  accel: 0.7,
  scrollSpeed: 2.2,
  naturalScroll: true,
  tapToClick: true,
  tapDrag: true,
  longPressDrag: true,
  inertia: true,
}

export interface Clock {
  now(): number
  after(ms: number, fn: () => void): () => void
}

const SLOP = 8            // dp a finger may wander and still be a tap
const TAP_MS = 260        // longest tap
const DOUBLE_MS = 240     // gap to the second tap of a tap-drag / double click
const LONG_MS = 480
const SWIPE_DP = 60
const FRAME_MS = 16

interface Finger { x: number; y: number; sx: number; sy: number; t: number }

type Mode = 'none' | 'move' | 'drag' | 'scroll' | 'zoom' | 'swipe' | 'done'

export class Touchpad {
  private fingers = new Map<number, Finger>()
  private mode: Mode = 'none'
  private maxFingers = 0
  private start = 0
  private moved = false
  // tap-then-drag and double click
  private pendingTap: (() => void) | null = null
  private secondTouch = false
  // long press
  private longTimer: (() => void) | null = null
  // two fingers
  private lastCenter = { x: 0, y: 0 }
  private lastSpread = 0
  private startSpread = 0
  private travel = { x: 0, y: 0 }
  private velocity = { x: 0, y: 0, t: 0 }
  private glide: (() => void) | null = null
  // the last pointer move, for acceleration
  private lastMoveT = 0
  /** Off in air mode: the phone's turning moves the pointer; fingers only click and scroll. */
  fingerMoves = true

  constructor(public settings: PadSettings, private emit: (o: Output) => void, private clock: Clock) {}

  down(id: number, x: number, y: number) {
    const t = this.clock.now()
    this.stopGlide()
    if (this.fingers.size === 0) {
      this.maxFingers = 0
      this.start = t
      this.moved = false
      this.mode = 'none'
      this.travel = { x: 0, y: 0 }
      this.lastMoveT = t
      if (this.pendingTap) {
        // touched again soon after a tap: a double click or a tap-drag
        this.pendingTap()
        this.pendingTap = null
        this.secondTouch = true
      } else {
        this.secondTouch = false
      }
    }
    this.fingers.set(id, { x, y, sx: x, sy: y, t })
    this.maxFingers = Math.max(this.maxFingers, this.fingers.size)
    this.cancelLong()
    if (this.fingers.size === 1 && this.settings.longPressDrag && !this.secondTouch) {
      this.longTimer = this.clock.after(LONG_MS, () => {
        this.longTimer = null
        if (this.fingers.size === 1 && !this.moved && this.mode === 'none') {
          this.mode = 'drag'
          this.emit({ t: 'haptic', kind: 'medium' })
          this.emit({ t: 'btn', b: 'left', a: 'down' })
        }
      })
    }
    if (this.fingers.size >= 2) this.resetTwo()
  }

  move(id: number, x: number, y: number) {
    const f = this.fingers.get(id)
    if (!f) return
    const t = this.clock.now()
    const dx = x - f.x
    const dy = y - f.y
    f.x = x
    f.y = y
    f.t = t
    if (Math.hypot(x - f.sx, y - f.sy) > SLOP) { this.moved = true; this.cancelLong() }
    if (this.mode === 'done') return
    const n = this.fingers.size

    if (n === 1 && this.maxFingers === 1) {
      if (this.mode === 'none' && this.moved) {
        if (this.secondTouch && this.settings.tapDrag) {
          this.mode = 'drag'
          this.emit({ t: 'btn', b: 'left', a: 'down' })
        } else {
          this.mode = 'move'
        }
      }
      if (this.mode === 'move' || this.mode === 'drag') this.pointer(dx, dy, t)
      return
    }

    if (n === 2) { this.two(t); return }
    if (n >= 3) this.swipe(n)
  }

  up(id: number) {
    const f = this.fingers.get(id)
    if (!f) return
    this.fingers.delete(id)
    if (this.fingers.size === 2) this.resetTwo()
    if (this.fingers.size > 0) {
      // lifting the first finger of a scroll ends it (and starts the glide: fingers never lift at
      // exactly the same time); the rest only rest on the pad
      if (this.mode === 'scroll') this.startGlide(this.clock.now())
      if (this.mode === 'scroll' || this.mode === 'zoom') this.mode = 'done'
      return
    }
    this.cancelLong()
    const t = this.clock.now()
    const quick = t - this.start < TAP_MS && !this.moved
    const mode = this.mode
    this.mode = 'none'

    if (mode === 'drag') { this.emit({ t: 'btn', b: 'left', a: 'up' }); return }
    if (mode === 'scroll') { this.startGlide(t); return }
    if (mode !== 'none' || !quick || !this.settings.tapToClick) {
      // a slow second touch that never moved still counts as the first tap's click
      if (this.secondTouch && mode === 'none') this.emit({ t: 'btn', b: 'left', a: 'click' })
      return
    }

    if (this.maxFingers === 2) { this.emit({ t: 'btn', b: 'right', a: 'click' }); return }
    if (this.maxFingers === 3) { this.emit({ t: 'btn', b: 'middle', a: 'click' }); return }
    if (this.maxFingers !== 1) return
    if (this.secondTouch) { this.emit({ t: 'btn', b: 'left', a: 'dbl' }); return }
    if (!this.settings.tapDrag) { this.emit({ t: 'btn', b: 'left', a: 'click' }); return }
    // wait a moment: a second touch makes this a double click or a drag
    const cancel = this.clock.after(DOUBLE_MS, () => {
      if (this.pendingTap === cancel) this.pendingTap = null
      this.emit({ t: 'btn', b: 'left', a: 'click' })
    })
    this.pendingTap = cancel
  }

  /** The touch was taken away (a system gesture...): let go of everything. */
  cancel() {
    this.cancelLong()
    this.stopGlide()
    if (this.pendingTap) { this.pendingTap(); this.pendingTap = null }
    if (this.mode === 'drag') this.emit({ t: 'btn', b: 'left', a: 'up' })
    this.fingers.clear()
    this.mode = 'none'
  }

  private pointer(dx: number, dy: number, t: number) {
    if (!this.fingerMoves) return
    const dt = Math.max(t - this.lastMoveT, 4)
    this.lastMoveT = t
    const speed = Math.hypot(dx, dy) / dt   // dp per ms
    const s = this.settings
    const gain = s.speed * Math.max(0.35, 1 + s.accel * (Math.min(speed, 4) - 0.35))
    this.emit({ t: 'm', x: dx * gain, y: dy * gain })
  }

  private center() {
    let x = 0, y = 0
    for (const f of this.fingers.values()) { x += f.x; y += f.y }
    const n = this.fingers.size || 1
    return { x: x / n, y: y / n }
  }

  private spread() {
    const [a, b] = [...this.fingers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  private resetTwo() {
    this.lastCenter = this.center()
    this.lastSpread = this.startSpread = this.spread()
    this.travel = { x: 0, y: 0 }
  }

  private two(t: number) {
    const c = this.center()
    const spread = this.spread()
    const dx = c.x - this.lastCenter.x
    const dy = c.y - this.lastCenter.y
    this.lastCenter = c
    this.travel.x += dx
    this.travel.y += dy
    if (this.mode === 'none' || this.mode === 'move') {
      const pinch = Math.abs(spread - this.startSpread)
      const pan = Math.hypot(this.travel.x, this.travel.y)
      if (pinch > 24 && pinch > pan * 1.5) { this.mode = 'zoom'; this.lastSpread = spread }
      else if (pan > SLOP) { this.mode = 'scroll'; this.velocity = { x: 0, y: 0, t } }
      else return
    }
    if (this.mode === 'zoom') {
      if (this.lastSpread > 0 && spread > 0) {
        const notches = Math.log2(spread / this.lastSpread) * 4
        if (Math.abs(notches) >= 0.25) { this.emit({ t: 'zoom', d: notches }); this.lastSpread = spread }
      }
      return
    }
    if (this.mode === 'scroll') {
      const [sx, sy] = this.wheel(dx, dy)
      if (sx || sy) this.emit({ t: 'scroll', x: sx, y: sy })
      // smoothed speed of the fingers, for the glide after lifting them
      const dt = Math.max(t - this.velocity.t, 1)
      const k = 0.35
      this.velocity = { x: this.velocity.x * (1 - k) + (dx / dt) * k, y: this.velocity.y * (1 - k) + (dy / dt) * k, t }
    }
  }

  /** Finger dp to wheel units. Positive wheel y scrolls up; natural scrolling moves the page with the fingers. */
  private wheel(dx: number, dy: number): [number, number] {
    const k = this.settings.scrollSpeed * (this.settings.naturalScroll ? 1 : -1)
    return [-dx * k, dy * k]
  }

  private startGlide(t: number) {
    if (!this.settings.inertia) return
    // fingers that stopped before lifting do not glide
    if (t - this.velocity.t > 80) return
    let vx = this.velocity.x, vy = this.velocity.y   // dp per ms
    if (Math.hypot(vx, vy) < 0.3) return
    const step = () => {
      vx *= 0.94
      vy *= 0.94
      if (Math.hypot(vx, vy) < 0.04) { this.glide = null; return }
      const [sx, sy] = this.wheel(vx * FRAME_MS, vy * FRAME_MS)
      this.emit({ t: 'scroll', x: sx, y: sy })
      this.glide = this.clock.after(FRAME_MS, step)
    }
    this.glide = this.clock.after(FRAME_MS, step)
  }

  private stopGlide() {
    if (this.glide) { this.glide(); this.glide = null }
  }

  private swipe(n: number) {
    if (this.mode !== 'none' && this.mode !== 'move' && this.mode !== 'swipe') return
    this.mode = 'swipe'
    let x = 0, y = 0
    for (const f of this.fingers.values()) { x += f.x - f.sx; y += f.y - f.sy }
    x /= n
    y /= n
    if (Math.max(Math.abs(x), Math.abs(y)) < SWIPE_DP) return
    const horizontal = Math.abs(x) > Math.abs(y)
    let key: { k: string; mods: string[] }
    if (n >= 4) {
      if (!horizontal) return
      key = { k: x < 0 ? 'right' : 'left', mods: ['ctrl', 'win'] }
    } else if (horizontal) {
      key = { k: 'tab', mods: x < 0 ? ['alt', 'shift'] : ['alt'] }
    } else {
      key = y < 0 ? { k: 'tab', mods: ['win'] } : { k: 'd', mods: ['win'] }
    }
    this.mode = 'done'
    this.emit({ t: 'haptic', kind: 'light' })
    this.emit({ t: 'key', ...key })
  }

  private cancelLong() {
    if (this.longTimer) { this.longTimer(); this.longTimer = null }
  }
}

/**
 * The scroll strip and the wheel button: one finger scrolls (gliding after a flick); a tap is the
 * strip's own click (the wheel button's middle click).
 */
export class Wheel {
  private y = 0
  private sy = 0
  private start = 0
  private moved = false
  private v = 0
  private vt = 0
  private glide: (() => void) | null = null
  private ticks = 0

  constructor(public settings: PadSettings, private emit: (o: Output) => void, private clock: Clock, private onTap?: () => void) {}

  down(y: number) {
    if (this.glide) { this.glide(); this.glide = null }
    this.y = this.sy = y
    this.start = this.clock.now()
    this.moved = false
    this.v = 0
    this.vt = this.start
    this.ticks = 0
  }

  move(y: number) {
    const t = this.clock.now()
    const dy = y - this.y
    this.y = y
    if (Math.abs(y - this.sy) > SLOP) this.moved = true
    if (!this.moved) return
    const k = this.settings.scrollSpeed * 1.4 * (this.settings.naturalScroll ? 1 : -1)
    this.emit({ t: 'scroll', x: 0, y: dy * k })
    // a light tick every ~notch, like a real wheel
    const ticks = Math.floor(Math.abs(y - this.sy) / 24)
    if (ticks !== this.ticks) { this.ticks = ticks; this.emit({ t: 'haptic', kind: 'tick' }) }
    const dt = Math.max(t - this.vt, 1)
    this.v = this.v * 0.65 + (dy / dt) * 0.35
    this.vt = t
  }

  up() {
    const t = this.clock.now()
    if (!this.moved) {
      if (t - this.start < TAP_MS && this.onTap) this.onTap()
      return
    }
    if (!this.settings.inertia || t - this.vt > 80 || Math.abs(this.v) < 0.3) return
    let v = this.v
    const k = this.settings.scrollSpeed * 1.4 * (this.settings.naturalScroll ? 1 : -1)
    const step = () => {
      v *= 0.94
      if (Math.abs(v) < 0.04) { this.glide = null; return }
      this.emit({ t: 'scroll', x: 0, y: v * FRAME_MS * k })
      this.glide = this.clock.after(FRAME_MS, step)
    }
    this.glide = this.clock.after(FRAME_MS, step)
  }

  cancel() {
    if (this.glide) { this.glide(); this.glide = null }
  }
}
