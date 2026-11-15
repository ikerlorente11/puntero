// More: power (lock, screen off, sleep, restart, shut down), Windows and browser shortcuts, the
// clipboard both ways, the settings, and this PC.
import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { disconnect, send, useLive } from '../live'
import { forgetPc, getData, updateSettings, useData } from '../store'
import { useTheme } from '../theme'
import { Btn, Card, Grid, haptic, SliderRow, SwitchRow } from '../ui'

const key = (k: string, mods: string[] = []) => () => { haptic(); send({ t: 'key', k, mods }) }

function confirm(title: string, message: string, action: () => void) {
  Alert.alert(title, message, [{ text: 'Cancelar', style: 'cancel' }, { text: title, style: 'destructive', onPress: action }])
}

export function MoreTab({ onLeave }: { onLeave: () => void }) {
  const t = useTheme()
  const { settings } = useData()
  const { pc, clip, latency, version } = useLive()
  const asked = useRef(0)
  const pad = settings.pad
  const air = settings.air
  const setPad = (patch: Partial<typeof pad>) => updateSettings({ pad: { ...getData().settings.pad, ...patch } })
  const setAir = (patch: Partial<typeof air>) => updateSettings({ air: { ...getData().settings.air, ...patch } })

  // the PC's clipboard arrives as an event: copy it into the phone's when we asked for it
  useEffect(() => {
    if (!clip || clip.at < asked.current) return
    Clipboard.setStringAsync(clip.s).then(() => Alert.alert('Copiado en el móvil', clip.s.length > 200 ? clip.s.slice(0, 200) + '…' : clip.s))
    asked.current = Infinity
  }, [clip])

  const power = (a: string) => () => { haptic('medium'); send({ t: 'power', a }) }

  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
      <Card title="Encendido">
        <Grid cols={3}>
          <Btn icon="lock-outline" label="Bloquear" onPress={power('lock')} />
          <Btn icon="monitor-off" label="Apagar pantalla" onPress={power('screenoff')} />
          <Btn icon="power-sleep" label="Suspender" onPress={() => confirm('Suspender', '¿Suspender el PC?', power('sleep'))} />
          <Btn icon="restart" label="Reiniciar" onPress={() => confirm('Reiniciar', '¿Reiniciar el PC ahora? Lo que no esté guardado se perderá.', power('restart'))} />
          <Btn icon="power" label="Apagar" danger onPress={() => confirm('Apagar', '¿Apagar el PC ahora? Lo que no esté guardado se perderá.', power('shutdown'))} />
          <Btn icon="logout" label="Cerrar sesión" onPress={() => confirm('Cerrar sesión', '¿Cerrar la sesión de Windows?', power('logoff'))} />
        </Grid>
      </Card>

      <Card title="Windows">
        <Grid cols={3}>
          <Btn icon="folder-outline" label="Explorador" small onPress={key('e', ['win'])} />
          <Btn icon="cog-outline" label="Configuración" small onPress={key('i', ['win'])} />
          <Btn icon="chart-box-outline" label="Administrador" small onPress={key('esc', ['ctrl', 'shift'])} />
          <Btn icon="close-box-outline" label="Cerrar ventana" small onPress={key('f4', ['alt'])} />
          <Btn icon="window-maximize" label="Maximizar" small onPress={key('up', ['win'])} />
          <Btn icon="window-minimize" label="Minimizar" small onPress={key('down', ['win'])} />
          <Btn icon="dock-left" label="A la izquierda" small onPress={key('left', ['win'])} />
          <Btn icon="monitor-multiple" label="Otra pantalla" small onPress={key('right', ['win', 'shift'])} />
          <Btn icon="dock-right" label="A la derecha" small onPress={key('right', ['win'])} />
          <Btn icon="emoticon-outline" label="Emojis" small onPress={key('period', ['win'])} />
          <Btn icon="clipboard-text-clock-outline" label="Historial" small onPress={key('v', ['win'])} />
          <Btn icon="magnify" label="Buscar" small onPress={key('s', ['win'])} />
        </Grid>
      </Card>

      <Card title="Navegador">
        <Grid cols={3}>
          <Btn icon="arrow-left" label="Atrás" small onPress={key('left', ['alt'])} />
          <Btn icon="refresh" label="Recargar" small onPress={key('f5')} />
          <Btn icon="arrow-right" label="Adelante" small onPress={key('right', ['alt'])} />
          <Btn icon="tab-plus" label="Nueva pestaña" small onPress={key('t', ['ctrl'])} />
          <Btn icon="tab-remove" label="Cerrar pestaña" small onPress={key('w', ['ctrl'])} />
          <Btn icon="tab" label="Siguiente" small onPress={key('tab', ['ctrl'])} />
          <Btn icon="restore" label="Reabrir" small onPress={key('t', ['ctrl', 'shift'])} />
          <Btn icon="magnify-plus-outline" label="Zoom +" small onPress={key('plus', ['ctrl'])} />
          <Btn icon="magnify-minus-outline" label="Zoom −" small onPress={key('minus', ['ctrl'])} />
          <Btn icon="fullscreen" label="Pantalla completa" small onPress={key('f11')} />
          <Btn icon="form-textbox" label="Barra de dirección" small onPress={key('l', ['ctrl'])} />
          <Btn icon="text-search" label="Buscar en la página" small onPress={key('f', ['ctrl'])} />
        </Grid>
      </Card>

      <Card title="Portapapeles">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn icon="cellphone-arrow-down" label="Móvil → PC" style={{ flex: 1 }} onPress={async () => {
            const s = await Clipboard.getStringAsync()
            if (!s) return Alert.alert('Portapapeles', 'No hay texto copiado en el móvil.')
            send({ t: 'clip', s })
            haptic('medium')
          }} />
          <Btn icon="monitor-arrow-down" label="PC → móvil" style={{ flex: 1 }} onPress={() => { asked.current = Date.now(); send({ t: 'clipget' }) }} />
        </View>
      </Card>

      <Card title="Touchpad">
        <SliderRow label="Velocidad del puntero" value={pad.speed} min={0.5} max={4} step={0.1} onChange={v => setPad({ speed: v })} />
        <SliderRow label="Aceleración" value={pad.accel} min={0} max={1.5} step={0.05} onChange={v => setPad({ accel: v })} format={v => (v === 0 ? 'Ninguna' : v.toFixed(2))} />
        <SliderRow label="Velocidad del desplazamiento" value={pad.scrollSpeed} min={0.5} max={6} step={0.1} onChange={v => setPad({ scrollSpeed: v })} />
        <SwitchRow label="Desplazamiento natural" hint="El contenido sigue a los dedos, como en el móvil" value={pad.naturalScroll} onChange={v => setPad({ naturalScroll: v })} />
        <SwitchRow label="Inercia" hint="Al desplazar rápido, sigue un poco tras soltar" value={pad.inertia} onChange={v => setPad({ inertia: v })} />
        <SwitchRow label="Tocar para hacer clic" value={pad.tapToClick} onChange={v => setPad({ tapToClick: v })} />
        <SwitchRow label="Tocar y arrastrar" hint="Toca, vuelve a tocar y mueve para arrastrar (el clic espera un instante)" value={pad.tapDrag} onChange={v => setPad({ tapDrag: v })} />
        <SwitchRow label="Mantener pulsado para arrastrar" value={pad.longPressDrag} onChange={v => setPad({ longPressDrag: v })} />
        <SwitchRow label="Botones bajo el touchpad" value={settings.showButtons} onChange={v => updateSettings({ showButtons: v })} />
      </Card>

      <Card title="Modo aire (giroscopio)">
        <SliderRow label="Sensibilidad" value={air.sensitivity} min={300} max={3000} step={50} onChange={v => setAir({ sensitivity: v })} format={v => `${Math.round(v / 11)} %`} />
        <SliderRow label="Recorrido a los lados" value={air.horizontal} min={1} max={3} step={0.1} onChange={v => setAir({ horizontal: v })} format={v => `×${v.toFixed(1)}`} />
        <SliderRow label="Aceleración" value={air.accel} min={0} max={1} step={0.05} onChange={v => setAir({ accel: v })} format={v => (v === 0 ? 'Ninguna (vuelve exacto)' : v.toFixed(2))} />
        <SwitchRow label="Mover solo con el pulgar en el touchpad" hint="Como el botón de un puntero láser: sueltas y el puntero se queda quieto" value={settings.airHold} onChange={v => updateSettings({ airHold: v })} />
        <SwitchRow label="Invertir horizontal" value={air.invertX} onChange={v => setAir({ invertX: v })} />
        <SwitchRow label="Invertir vertical" value={air.invertY} onChange={v => setAir({ invertY: v })} />
      </Card>

      <Card title="General">
        <SwitchRow label="Vibrar al tocar" value={settings.haptics} onChange={v => updateSettings({ haptics: v })} />
        <SwitchRow label="Mantener la pantalla encendida" hint="Mientras controlas el PC" value={settings.keepAwake} onChange={v => updateSettings({ keepAwake: v })} />
        <SwitchRow label="Conectar al último PC al abrir" hint="Si está encendido y en la misma wifi, la app va directa a él" value={settings.autoConnect} onChange={v => updateSettings({ autoConnect: v })} />
      </Card>

      {pc && (
        <Card title="Este PC">
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{pc.name}</Text>
          <Text style={{ color: t.muted }}>
            {pc.lastHost ?? pc.hosts[0]}:{pc.port}{version ? ` · El Puntero ${version}` : ''}{latency != null ? ` · ${latency} ms` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn icon="lan-disconnect" label="Desconectar" style={{ flex: 1 }} onPress={() => { disconnect(); onLeave() }} />
            <Btn icon="delete-outline" label="Olvidar" danger style={{ flex: 1 }} onPress={() => confirm('Olvidar', `¿Olvidar ${pc.name}? Tendrás que volver a emparejarlo.`, () => { forgetPc(pc.id); disconnect(); onLeave() })} />
          </View>
        </Card>
      )}
    </ScrollView>
  )
}
