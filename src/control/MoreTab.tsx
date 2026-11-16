// More: power (lock, screen off, sleep, restart, shut down), Windows and browser shortcuts, the
// clipboard both ways, this PC, and the way to the settings (the same as from the PCs).
import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { Alert, Modal, ScrollView, Text, View } from 'react-native'
import { disconnect, send, useLive } from '../live'
import { SettingsScreen } from '../screens/SettingsScreen'
import { forgetPc } from '../store'
import { useTheme } from '../theme'
import { Btn, Card, Grid, haptic } from '../ui'

const key = (k: string, mods: string[] = []) => () => { haptic(); send({ t: 'key', k, mods }) }

function confirm(title: string, message: string, action: () => void) {
  Alert.alert(title, message, [{ text: 'Cancelar', style: 'cancel' }, { text: title, style: 'destructive', onPress: action }])
}

export function MoreTab({ onLeave }: { onLeave: () => void }) {
  const t = useTheme()
  const { pc, clip, latency, version } = useLive()
  const asked = useRef(0)
  const [settings, setSettings] = useState(false)

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

      <Btn icon="cog-outline" label="Ajustes (touchpad, modo aire, conexión…)" onPress={() => setSettings(true)} />

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

      {settings && (
        <Modal animationType="slide" onRequestClose={() => setSettings(false)}>
          <SettingsScreen onClose={() => setSettings(false)} />
        </Modal>
      )}
    </ScrollView>
  )
}
