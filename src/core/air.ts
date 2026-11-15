// Air mouse: the phone's turning speed (gyroscope) becomes pointer movement, whatever way the phone
// is held. Turning left/right is the rotation around the vertical (gravity, from the accelerometer),
// so it works with the phone flat, upright or anything in between; tilting up/down is the rotation
// around the phone's own side-to-side axis.
//
// Turning out and back by the same angle must land where it started, however fast each way: so the
// acceleration is mild (and can be off), and the dead zone fades in instead of cutting a slice off
// every movement.

export interface AirSettings {
  /** pixels per radian, vertically */
  sensitivity: number
  /** how much more the pointer travels sideways than up and down (screens are wider than tall) */
  horizontal: number
  /** 0 = the same angle is always the same distance; up to 1 = quick turns go up to twice as far */
  accel: number
  invertX: boolean
  invertY: boolean
}

export const DEFAULT_AIR: AirSettings = { sensitivity: 1100, horizontal: 1.8, accel: 0, invertX: false, invertY: false }

export type Vec = { x: number; y: number; z: number }

const DEADZONE = 0.012   // rad/s: a hand holding still (gyroscope noise)
const SMOOTH = 0.35

export class AirMouse {
  private gravity: Vec = { x: 0, y: 0, z: 1 }
  private sx = 0
  private sy = 0

  constructor(public settings: AirSettings) {}

  /** Accelerometer reading (any unit): only its direction is used, smoothed. */
  accel(a: Vec) {
    const k = 0.15
    this.gravity = { x: this.gravity.x * (1 - k) + a.x * k, y: this.gravity.y * (1 - k) + a.y * k, z: this.gravity.z * (1 - k) + a.z * k }
  }

  reset() { this.sx = this.sy = 0 }

  /** Gyroscope reading in rad/s over `dt` seconds: the pointer move in pixels. */
  gyro(w: Vec, dt: number): { x: number; y: number } {
    const g = this.gravity
    const len = Math.hypot(g.x, g.y, g.z) || 1
    const yaw = (w.x * g.x + w.y * g.y + w.z * g.z) / len
    const pitch = w.x
    // a little smoothing takes the hand's tremor out (linear, so it loses nothing on the way back)
    this.sx = this.sx * SMOOTH + yaw * (1 - SMOOTH)
    this.sy = this.sy * SMOOTH + pitch * (1 - SMOOTH)
    const s = this.settings
    const shape = (rate: number) => {
      const a = Math.abs(rate)
      if (a < DEADZONE) return 0
      // fades in between 1x and 2x the dead zone, full speed above: slow turns are not shortened
      const fade = Math.min((a - DEADZONE) / DEADZONE, 1)
      const gain = 1 + s.accel * Math.min(Math.max((a - 0.6) / 2.4, 0), 1)
      return rate * fade * gain * s.sensitivity * dt
    }
    return {
      x: shape(this.sx) * s.horizontal * (s.invertX ? 1 : -1),
      y: shape(this.sy) * (s.invertY ? 1 : -1),
    }
  }
}
