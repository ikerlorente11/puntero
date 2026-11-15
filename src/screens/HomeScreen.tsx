// The PCs: the paired ones (tap to control), the ones found on the network (tap to pair with the
// code) and "Escanear QR" to pair with the QR the PC shows.
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Linking from 'expo-linking'
import * as Network from 'expo-network'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { pair, Pc } from '../core/client'
import { DEFAULT_PORT, parsePairLink, PairLink } from '../core/link'
import { FoundPc, scan } from '../core/scan'
import { forgetPc, getData, savePc, useData } from '../store'
import { useTheme } from '../theme'
import { Btn, Card, haptic, Icon } from '../ui'

/** the Windows half: the README of the repo has the download and the instructions */
const PC_DOWNLOAD = 'https://github.com/ikerlorente11/puntero#el-pc'

export function HomeScreen({ onOpen, incomingLink, clearIncoming }: { onOpen: (pc: Pc) => void; incomingLink: string | null; clearIncoming: () => void }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { pcs } = useData()
  const [found, setFound] = useState<FoundPc[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const [codeFor, setCodeFor] = useState<{ hosts: string[]; port: number; id?: string; name: string } | null>(null)
  const [manual, setManual] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const runScan = async () => {
    if (scanning) return
    setScanning(true)
    setScanNote(null)
    setFound([])
    try {
      const ip = await Network.getIpAddressAsync()
      const hits = await scan(fetch as any, ip, DEFAULT_PORT, pc => setFound(f => [...f, pc]))
      if (!hits.length) setScanNote('No aparece ningún PC. ¿Está El Puntero abierto en el PC y el móvil en la misma wifi?')
    } catch {
      setScanNote('No se puede buscar: ¿estás conectado a una wifi?')
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => { runScan() }, [])

  const pairWith = async (target: { hosts: string[]; port: number; id?: string }, secret: Parameters<typeof pair>[3], label: string) => {
    setBusy(label)
    try {
      const pc = await pair(WebSocket as any, getData().identity, target, secret)
      savePc(pc)
      haptic('medium')
      setCodeFor(null)
      setManual(false)
      onOpen(pc)
    } catch (e) {
      Alert.alert('No se ha podido emparejar', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const pairLink = (link: PairLink) => pairWith(link, { via: 'qr', key: link.secret }, link.name)

  // a QR read by the phone's own camera opens the app with the link
  useEffect(() => {
    if (!incomingLink) return
    clearIncoming()
    const link = parsePairLink(incomingLink)
    if (link) pairLink(link)
  }, [incomingLink])

  const known = new Set(pcs.map(p => p.id))
  const others = found.filter(f => !known.has(f.id))
  const online = new Set(found.map(f => f.id))

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <View style={styles.header}>
          <Icon name="cursor-default-click" size={30} color={t.amber} />
          <Text style={[styles.title, { color: t.text }]}>El Puntero</Text>
        </View>

        {pcs.length > 0 && (
          <Card title="Tus PCs">
            {pcs.map(pc => (
              <Pressable
                key={pc.id}
                onPress={() => { haptic(); onOpen(pc) }}
                onLongPress={() => Alert.alert(pc.name, '¿Olvidar este PC? Tendrás que volver a emparejarlo.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Olvidar', style: 'destructive', onPress: () => forgetPc(pc.id) },
                ])}
                style={({ pressed }) => [styles.pcRow, { backgroundColor: pressed ? t.raised : 'transparent' }]}
              >
                <Icon name="monitor" size={28} color={t.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pcName, { color: t.text }]}>{pc.name}</Text>
                  <Text style={{ color: online.has(pc.id) ? t.ok : t.muted, fontSize: 12 }}>
                    {online.has(pc.id) ? 'En la red ahora' : pc.lastHost ?? pc.hosts[0]}
                  </Text>
                </View>
                <Icon name="chevron-right" color={t.muted} />
              </Pressable>
            ))}
          </Card>
        )}

        <Card title="Añadir PC">
          <Text style={{ color: t.muted, lineHeight: 20 }}>
            Instala El Puntero en el PC (con PC Toolkit o su instalador), ábrelo y escanea el QR de su ventana.
          </Text>
          <Btn icon="qrcode-scan" label="Escanear el QR del PC" primary onPress={() => setCamera(true)} />
          <Pressable onPress={() => Linking.openURL(PC_DOWNLOAD)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="microsoft-windows" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '600' }}>Descargar El Puntero para el PC</Text>
          </Pressable>
          <View style={styles.foundHead}>
            <Text style={{ color: t.muted, fontWeight: '600' }}>PCs en esta red</Text>
            {scanning ? <ActivityIndicator color={t.accent} /> : (
              <Pressable onPress={runScan} hitSlop={10}><Icon name="refresh" color={t.accent} /></Pressable>
            )}
          </View>
          {others.map(f => (
            <Pressable key={f.id} onPress={() => setCodeFor({ hosts: [f.host], port: f.port, id: f.id, name: f.name })}
              style={({ pressed }) => [styles.pcRow, { backgroundColor: pressed ? t.raised : 'transparent' }]}>
              <Icon name="monitor-arrow-down" size={26} color={t.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pcName, { color: t.text }]}>{f.name}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{f.host} · toca para emparejar con el código</Text>
              </View>
            </Pressable>
          ))}
          {!scanning && !others.length && (
            <Text style={{ color: t.muted, fontSize: 13 }}>{scanNote ?? (found.length ? 'Los PCs de esta red ya están emparejados.' : '')}</Text>
          )}
          <Pressable onPress={() => setManual(true)} hitSlop={8}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>Escribir la dirección del PC a mano</Text>
          </Pressable>
        </Card>
      </ScrollView>

      {camera && <QrModal onClose={() => setCamera(false)} onLink={link => { setCamera(false); pairLink(link) }} />}
      {(codeFor || manual) && (
        <CodeModal
          target={codeFor}
          busy={!!busy}
          onClose={() => { setCodeFor(null); setManual(false) }}
          onPair={(target, code) => pairWith(target, { via: 'code', code }, target.hosts[0])}
        />
      )}
      {busy && (
        <View style={[StyleSheet.absoluteFill, styles.busy]}>
          <ActivityIndicator size="large" color={t.accent} />
          <Text style={{ color: '#fff', marginTop: 12 }}>Emparejando con {busy}…</Text>
        </View>
      )}
    </View>
  )
}

function QrModal({ onClose, onLink }: { onClose: () => void; onLink: (l: PairLink) => void }) {
  const t = useTheme()
  const [permission, request] = useCameraPermissions()
  const done = useRef(false)
  const [wrong, setWrong] = useState(false)
  useEffect(() => { if (permission && !permission.granted && permission.canAskAgain) request() }, [permission])
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (done.current) return
              const link = parsePairLink(data)
              if (!link) { setWrong(true); return }
              done.current = true
              haptic('medium')
              onLink(link)
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>Para leer el QR del PC hace falta la cámara.</Text>
            <Btn label="Permitir la cámara" primary onPress={request} />
          </View>
        )}
        <View style={styles.qrOverlay} pointerEvents="box-none">
          <View style={[styles.qrFrame, { borderColor: t.accent }]} />
          <Text style={styles.qrText}>{wrong ? 'Ese QR no es de El Puntero' : 'Apunta al QR de la ventana de El Puntero en el PC'}</Text>
          <Btn label="Cancelar" onPress={onClose} style={{ marginTop: 24, paddingHorizontal: 28 }} />
        </View>
      </View>
    </Modal>
  )
}

function CodeModal({ target, busy, onClose, onPair }: {
  target: { hosts: string[]; port: number; id?: string; name: string } | null
  busy: boolean
  onClose: () => void
  onPair: (target: { hosts: string[]; port: number; id?: string }, code: string) => void
}) {
  const t = useTheme()
  const [host, setHost] = useState('')
  const [code, setCode] = useState('')
  const digits = code.replace(/\D/g, '')
  const ready = digits.length === 6 && (target || host.trim())
  const go = () => {
    if (!ready) return
    if (target) return onPair(target, digits)
    const [h, p] = host.trim().split(':')
    onPair({ hosts: [h], port: Number(p) || DEFAULT_PORT }, digits)
  }
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetBack}>
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text style={[styles.pcName, { color: t.text, fontSize: 18 }]}>{target ? `Emparejar con ${target.name}` : 'Emparejar a mano'}</Text>
          {!target && (
            <TextInput
              value={host} onChangeText={setHost} placeholder="Dirección del PC (192.168.1.20)" placeholderTextColor={t.muted}
              autoCapitalize="none" autoCorrect={false} keyboardType="url"
              style={[styles.input, { color: t.text, borderColor: t.line, backgroundColor: t.bg }]}
            />
          )}
          <Text style={{ color: t.muted }}>Escribe el código de 6 cifras que muestra la ventana de El Puntero en el PC.</Text>
          <TextInput
            value={code} onChangeText={setCode} placeholder="000 000" placeholderTextColor={t.muted}
            keyboardType="number-pad" maxLength={7} autoFocus onSubmitEditing={go}
            style={[styles.input, styles.codeInput, { color: t.text, borderColor: t.line, backgroundColor: t.bg }]}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
            <Btn label="Emparejar" primary disabled={!ready || busy} onPress={go} style={{ flex: 1 }} />
          </View>
          <Text style={{ color: t.muted, fontSize: 12 }}>Con el QR la conexión queda mejor protegida: úsalo si puedes.</Text>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800' },
  pcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  pcName: { fontSize: 16, fontWeight: '700' },
  foundHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  busy: { backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  qrOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  qrFrame: { width: 250, height: 250, borderWidth: 3, borderRadius: 24 },
  qrText: { color: '#fff', marginTop: 20, textAlign: 'center', paddingHorizontal: 30, fontSize: 15, textShadowColor: '#000', textShadowRadius: 4 },
  sheetBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 20, padding: 18, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
})
