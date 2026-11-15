// The mouse: one touch surface split into zones (touchpad, scroll strip, left button, wheel, right
// button). A single view takes every finger and routes each one by where it landed, so a finger can
// hold the left button while another moves the pointer: separate buttons cannot do that in React
// Native (only one view gets the touches at a time).
//
// Air mode: the gyroscope moves the pointer (by default only while a finger rests on the pad, like
// the button of a laser pointer); taps still click.
import { Accelerometer, Gyroscope } from 'expo-sensors'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GestureResponderEvent, HostInstance, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import { AirMouse } from '../core/air'
import { Clock, Output, Touchpad, Wheel } from '../core/touchpad'
import { send } from '../live'
import { useData } from '../store'
import { useTheme } from '../theme'
import { haptic, Icon } from '../ui'

type Zone = 'pad' | 'strip' | 'left' | 'wheel' | 'right'

const STRIP_W = 46
const GAP = 8

const clock: Clock = {
  now: () => Date.now(),
  after: (ms, fn) => { const h = setTimeout(fn, ms); return () => clearTimeout(h) },
}

function out(o: Output) {
  if (o.t === 'haptic') haptic(o.kind)
  else send(o)
}

/** compact: the small pad under the other tabs (touchpad, strip and buttons, shorter, no hints) */
export function MouseTab({ air, compact = false }: { air: boolean; compact?: boolean }) {
  const t = useTheme()
  const { settings } = useData()
  const [size, setSize] = useState({ w: 0, h: 0 })
  const origin = useRef({ x: 0, y: 0 })
  const surface = useRef<HostInstance>(null)
  const zones = useRef(new Map<number, Zone>())
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const buttonsH = settings.showButtons ? (compact ? 50 : 84) : 0

  const pad = useMemo(() => new Touchpad(settings.pad, out, clock), [])
  const strip = useMemo(() => new Wheel(settings.pad, out, clock), [])
  const wheel = useMemo(() => new Wheel(settings.pad, out, clock, () => { haptic(); send({ t: 'btn', b: 'middle', a: 'click' }) }), [])
  const airMouse = useMemo(() => new AirMouse(settings.air), [])

  useEffect(() => {
    pad.settings = air ? { ...settings.pad, longPressDrag: false } : settings.pad
    pad.fingerMoves = !air
    strip.settings = wheel.settings = settings.pad
    airMouse.settings = settings.air
  }, [settings.pad, settings.air, air])

  // ---- air mode: gyroscope (+ accelerometer for which way is down)
  const holding = useRef(0)
  useEffect(() => {
    if (!air) return
    airMouse.reset()
    Gyroscope.setUpdateInterval(10)
    Accelerometer.setUpdateInterval(40)
    let last = 0
    const acc = Accelerometer.addListener(a => airMouse.accel(a))
    const gyro = Gyroscope.addListener(g => {
      const now = Date.now()
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.01
      last = now
      const m = airMouse.gyro(g, dt)
      if (settings.airHold && holding.current === 0) return
      if (m.x || m.y) send({ t: 'm', x: m.x, y: m.y })
    })
    return () => { acc.remove(); gyro.remove() }
  }, [air, settings.airHold])

  // ---- zones
  const padH = Math.max(size.h - buttonsH - (buttonsH ? GAP : 0), 0)
  const zoneAt = (x: number, y: number): Zone => {
    if (y >= padH + (buttonsH ? GAP / 2 : 0) && buttonsH) {
      if (x < size.w * 0.4) return 'left'
      if (x > size.w * 0.6) return 'right'
      return 'wheel'
    }
    return x > size.w - STRIP_W - GAP / 2 ? 'strip' : 'pad'
  }

  const press = (zone: 'left' | 'right', down: boolean) => {
    setHeld(h => ({ ...h, [zone]: down }))
    if (down) haptic()
    send({ t: 'btn', b: zone, a: down ? 'down' : 'up' })
  }

  const start = (e: GestureResponderEvent) => {
    // where the surface is on screen, from the touch itself (the surface moves when the keyboard opens)
    // (only with the first finger down: Android's locationX of a second finger is not reliable)
    const ev = e.nativeEvent
    if (ev.touches.length === ev.changedTouches.length) origin.current = { x: ev.pageX - ev.locationX, y: ev.pageY - ev.locationY }
    for (const touch of e.nativeEvent.changedTouches) {
      const x = touch.pageX - origin.current.x
      const y = touch.pageY - origin.current.y
      const id = Number(touch.identifier)
      const zone = zoneAt(x, y)
      zones.current.set(id, zone)
      if (zone !== 'strip' && zone !== 'wheel') holding.current++
      if (zone === 'pad') pad.down(id, x, y)
      else if (zone === 'strip') strip.down(y)
      else if (zone === 'wheel') { wheel.down(y); setHeld(h => ({ ...h, wheel: true })) }
      else press(zone, true)
    }
  }

  const move = (e: GestureResponderEvent) => {
    for (const touch of e.nativeEvent.changedTouches) {
      const id = Number(touch.identifier)
      const zone = zones.current.get(id)
      const x = touch.pageX - origin.current.x
      const y = touch.pageY - origin.current.y
      if (zone === 'pad') pad.move(id, x, y)
      else if (zone === 'strip') strip.move(y)
      else if (zone === 'wheel') wheel.move(y)
    }
  }

  const end = (e: GestureResponderEvent, cancelled = false) => {
    for (const touch of e.nativeEvent.changedTouches) {
      const id = Number(touch.identifier)
      const zone = zones.current.get(id)
      zones.current.delete(id)
      if (!zone) continue
      if (zone !== 'strip' && zone !== 'wheel') holding.current = Math.max(0, holding.current - 1)
      if (zone === 'pad') cancelled ? pad.cancel() : pad.up(id)
      else if (zone === 'strip') strip.up()
      else if (zone === 'wheel') { wheel.up(); setHeld(h => ({ ...h, wheel: false })) }
      else press(zone, false)
    }
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ w: width, h: height })
    surface.current?.measure((_x, _y, _w, _h, pageX, pageY) => { origin.current = { x: pageX, y: pageY } })
  }

  // let go of everything if the tab goes away with fingers down
  useEffect(() => () => {
    pad.cancel(); strip.cancel(); wheel.cancel()
    send({ t: 'btn', b: 'left', a: 'up' })
  }, [])

  const btnStyle = (on: boolean) => [styles.button, { backgroundColor: on ? t.accent : t.raised }]
  const btnText = (on: boolean) => ({ color: on ? t.accentText : t.muted, fontWeight: '700' as const, fontSize: compact ? 12 : 13, letterSpacing: 0.6 })

  return (
    <View
      ref={surface}
      style={{ flex: 1 }}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={e => end(e)}
      onTouchCancel={e => end(e, true)}
    >
      {size.w > 0 && (
        <>
          <View pointerEvents="none" style={[styles.pad, { width: size.w - STRIP_W - GAP, height: padH, backgroundColor: t.pad, borderColor: air ? t.amber : t.padLine }]}>
            <Icon name={air ? 'rotate-3d-variant' : 'gesture-tap'} size={compact ? 24 : 40} color={t.padLine} />
            {!compact && (
              <Text style={[styles.hint, { color: t.muted }]}>
                {air
                  ? settings.airHold ? 'Deja el pulgar aquí y gira el móvil para mover\nToca para clic' : 'Gira el móvil para mover · Toca para clic'
                  : 'Desliza para mover · Toca para clic\nDos dedos: desplazar, pellizcar o clic derecho\nMantén pulsado para arrastrar'}
              </Text>
            )}
          </View>
          <View pointerEvents="none" style={[styles.strip, { left: size.w - STRIP_W, width: STRIP_W, height: padH, backgroundColor: t.pad, borderColor: t.padLine }]}>
            <Icon name="chevron-up" color={t.muted} />
            <View style={[styles.stripLine, { backgroundColor: t.padLine }]} />
            <Icon name="chevron-down" color={t.muted} />
          </View>
          {buttonsH > 0 && (
            <View pointerEvents="none" style={[styles.buttons, { top: padH + GAP, height: buttonsH }]}>
              <View style={[btnStyle(!!held.left), { flex: 4 }]}><Text style={btnText(!!held.left)}>IZQUIERDO</Text></View>
              <View style={[btnStyle(!!held.wheel), { flex: 2 }]}>
                <Icon name="unfold-more-horizontal" color={held.wheel ? t.accentText : t.muted} />
              </View>
              <View style={[btnStyle(!!held.right), { flex: 4 }]}><Text style={btnText(!!held.right)}>DERECHO</Text></View>
            </View>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { position: 'absolute', left: 0, top: 0, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  hint: { textAlign: 'center', fontSize: 13, lineHeight: 20 },
  strip: { position: 'absolute', top: 0, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  stripLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: 6 },
  buttons: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: GAP },
  button: { borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
