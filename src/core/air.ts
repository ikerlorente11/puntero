// Air mouse: the phone's turning speed (gyroscope) becomes pointer movement, whatever way the phone
// is held. Turning left/right is the rotation around the vertical (gravity, from the accelerometer),
// so it works with the phone flat, upright or anything in between; tilting up/down is the rotation
// around the phone's own side-to-side axis.

export interface AirSettings {
  /** pixels per radian at moderate speed */
  sensitivity: number
  invertX: boolean
  invertY: boolean
}

export const DEFAULT_AIR: AirSettings = { sensitivity: 1100, invertX: false, invertY: false }

export type Vec = { x: number; y: number; z: number }

const DEADZONE = 0.025   // rad/s: a hand holding still
const SMOOTH = 0.45

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
    // smoothing takes the hand's tremor out; a dead zone stops the drift of a phone held still
    this.sx = this.sx * SMOOTH + yaw * (1 - SMOOTH)
    this.sy = this.sy * SMOOTH + pitch * (1 - SMOOTH)
    const s = this.settings
    const shape = (rate: number) => {
      const a = Math.abs(rate)
      if (a < DEADZONE) return 0
      // slow turns are precise, quick ones cross the screen
      const gain = 0.55 + Math.min(a / 1.5, 1.6)
      return Math.sign(rate) * (a - DEADZONE) * gain * s.sensitivity * dt
    }
    return { x: shape(this.sx) * (s.invertX ? 1 : -1), y: shape(this.sy) * (s.invertY ? 1 : -1) }
  }
}
