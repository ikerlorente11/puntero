// El Puntero: control a Windows PC's mouse and keyboard from the phone. Two screens: the PCs (pair,
// pick) and the control of one PC. On opening, the last PC used opens straight away if it is on the
// network (setting "Conectar al último PC al abrir"); otherwise, the PCs.
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Pc } from './src/core/client'
import { findPc } from './src/core/scan'
import { connectTo, disconnect } from './src/live'
import { ControlScreen } from './src/screens/ControlScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { Data, loadStore, update } from './src/store'
import { useTheme } from './src/theme'
import { Btn } from './src/ui'

export default function App() {
  const t = useTheme()
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<'home' | 'finding' | 'control'>('home')
  const [incoming, setIncoming] = useState<string | null>(null)
  const [finding, setFinding] = useState<Pc | null>(null)
  /** bumped to drop a startup search that is no longer wanted (cancelled, or a pairing link came in) */
  const search = useRef(0)

  useEffect(() => {
    // a pairing QR read with the phone's camera app opens El Puntero with the link
    Promise.all([loadStore(), Linking.getInitialURL().catch(() => null)]).then(([data, url]: [Data, string | null]) => {
      setReady(true)
      if (url?.startsWith('puntero://pair')) { setIncoming(url); return }
      const last = data.pcs.find(p => p.id === data.lastPc)
      if (!last || !data.settings.autoConnect) return
      const mine = ++search.current
      setFinding(last)
      setScreen('finding')
      findPc(fetch as any, last).then(host => {
        if (mine !== search.current) return
        setFinding(null)
        if (host) { connectTo({ ...last, lastHost: host }); setScreen('control') }
        else setScreen('home')
      })
    })
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('puntero://pair')) return
      search.current++
      setFinding(null)
      disconnect(); setScreen('home'); setIncoming(url)
    })
    return () => sub.remove()
  }, [])

  const open = (pc: Pc) => {
    update(d => ({ ...d, lastPc: pc.id }))
    connectTo(pc)
    setScreen('control')
  }

  const back = () => {
    disconnect()
    setScreen('home')
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {ready && (screen === 'finding' && finding
          ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
              <Image source={require('./assets/icon.png')} style={{ width: 64, height: 64, borderRadius: 16 }} />
              <ActivityIndicator color={t.accent} size="large" />
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>Conectando con {finding.name}…</Text>
              <Btn icon="close" label="Ver mis PCs" onPress={() => { search.current++; setFinding(null); setScreen('home') }} />
            </View>
          )
          : screen === 'control'
            ? <ControlScreen onBack={back} />
            : <HomeScreen onOpen={open} incomingLink={incoming} clearIncoming={() => setIncoming(null)} />)}
      </View>
    </SafeAreaProvider>
  )
}
