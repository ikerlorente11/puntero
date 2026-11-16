// The app's settings, the same for every PC: connecting, this phone, the touchpad, air mode, and the
// version with what is new. Opened from the PCs (no PC needed) or from Más while controlling one.
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CHANGES, RELEASE } from '../release'
import { getData, update, updateSettings, useData } from '../store'
import { useTheme } from '../theme'
import { Card, Icon, SliderRow, SwitchRow } from '../ui'

/** the Windows half: the README of the repo has the download and the instructions */
export const PC_DOWNLOAD = 'https://github.com/ikerlorente11/puntero#el-pc'

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { settings, identity, pcs } = useData()
  const [name, setName] = useState(identity.name)
  const [allChanges, setAllChanges] = useState(false)
  const pad = settings.pad
  const air = settings.air
  const setPad = (patch: Partial<typeof pad>) => updateSettings({ pad: { ...getData().settings.pad, ...patch } })
  const setAir = (patch: Partial<typeof air>) => updateSettings({ air: { ...getData().settings.air, ...patch } })
  const saveName = () => {
    const clean = name.trim().slice(0, 40)
    if (!clean) { setName(getData().identity.name); return }
    if (clean !== getData().identity.name) update(d => ({ ...d, identity: { ...d.identity, name: clean } }))
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Volver">
          <Icon name="arrow-left" />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Ajustes</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <Card title="Conexión">
          <SwitchRow label="Conectar al último PC al abrir" hint="Si está encendido y en la misma wifi, la app va directa a él (también al volver a la app)" value={settings.autoConnect} onChange={v => updateSettings({ autoConnect: v })} />
          <SwitchRow label="Mantener la pantalla encendida" hint="Mientras controlas el PC" value={settings.keepAwake} onChange={v => updateSettings({ keepAwake: v })} />
          <SwitchRow label="Vibrar al tocar" value={settings.haptics} onChange={v => updateSettings({ haptics: v })} />
        </Card>

        <Card title="Este móvil">
          <Text style={{ color: t.muted }}>Nombre con el que lo ven los PCs</Text>
          <TextInput
            value={name} onChangeText={setName} onEndEditing={saveName} onSubmitEditing={saveName} maxLength={40}
            placeholder="Móvil" placeholderTextColor={t.muted} autoCorrect={false}
            style={[styles.input, { color: t.text, borderColor: t.line, backgroundColor: t.bg }]}
          />
          <Text style={{ color: t.muted, fontSize: 12 }}>
            {pcs.length === 1 ? 'Emparejado con 1 PC.' : `Emparejado con ${pcs.length} PCs.`} Los PCs ven el nombre nuevo la próxima vez que te conectes.
          </Text>
        </Card>

        <Card title="Touchpad">
          <SliderRow label="Velocidad del puntero" value={pad.speed} min={0.5} max={4} step={0.1} onChange={v => setPad({ speed: v })} />
          <SliderRow label="Aceleración" value={pad.accel} min={0} max={1.5} step={0.05} onChange={v => setPad({ accel: v })} format={v => (v === 0 ? 'Ninguna' : v.toFixed(2))} />
          <SliderRow label="Velocidad del desplazamiento" value={pad.scrollSpeed} min={0.5} max={6} step={0.1} onChange={v => setPad({ scrollSpeed: v })} />
          <SwitchRow label="Desplazamiento natural" hint="El contenido sigue a los dedos, como en el móvil" value={pad.naturalScroll} onChange={v => setPad({ naturalScroll: v })} />
          <SwitchRow label="Invertir la rueda" hint="Cambia el sentido de la tira de desplazamiento y de la rueda; los dos dedos siguen igual" value={pad.invertWheel} onChange={v => setPad({ invertWheel: v })} />
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

        <Card title="Acerca de">
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>El Puntero {RELEASE}</Text>
          {(allChanges ? CHANGES : CHANGES.slice(0, 1)).map(c => (
            <View key={c.version} style={{ gap: 4 }}>
              <Text style={{ color: t.muted, fontWeight: '600' }}>Novedades de la {c.version} · {c.date}</Text>
              {c.items.map(item => (
                <View key={item} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: t.muted }}>•</Text>
                  <Text style={{ color: t.text, flex: 1, lineHeight: 20 }}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
          {CHANGES.length > 1 && (
            <Pressable onPress={() => setAllChanges(a => !a)} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: '600' }}>{allChanges ? 'Ver solo la última' : 'Ver versiones anteriores'}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => Linking.openURL(PC_DOWNLOAD)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="microsoft-windows" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '600' }}>El Puntero para el PC (descarga e instrucciones)</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerBtn: { padding: 6 },
  title: { fontSize: 22, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
})
