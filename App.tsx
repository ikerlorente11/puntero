// El Puntero: control a Windows PC's mouse and keyboard from the phone. Screens: the PCs (pair, pick),
// the control of one PC and the settings. On opening the app, and on coming back to it on the PCs, the
// last PC used opens straight away if it is on the network (setting "Conectar al último PC al abrir").
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, BackHandler, Image, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Pc } from './src/core/client'
import { findPc } from './src/core/scan'
import { connectTo, disconnect } from './src/live'
import { ControlScreen } from './src/screens/ControlScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { getData, loadStore, update, updatePc } from './src/store'
import { useTheme } from './src/theme'
import { Btn } from './src/ui'

type Screen = 'home' | 'finding' | 'control' | 'settings'

/** The wifi can take a moment to be back when the phone wakes up: a few tries before giving up. */
async function findLast(pc: Pc, tries = 3): Promise<{ host: string; port: number } | null> {
  for (let i = 0; i < tries; i++) {
    const found = await findPc(fetch as any, pc, 1500)
    if (found) return found
    if (i < tries - 1) await new Promise(r => setTimeout(r, 800))
  }
  return null
}

export default function App() {
  const t = useTheme()
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [incoming, setIncoming] = useState<string | null>(null)
  const [finding, setFinding] = useState<Pc | null>(null)
  /** bumped to drop a search for the last PC that is no longer wanted (cancelled, or a pairing link came in) */
  const search = useRef(0)
  const screenRef = useRef<Screen>('home')
  useEffect(() => { screenRef.current = screen }, [screen])

  /** Goes straight to the last PC used if the setting is on and it answers; otherwise stays on the PCs. */
  const openLast = () => {
    const data = getData()
    const last = data.pcs.find(p => p.id === data.lastPc)
    if (!last || !data.settings.autoConnect) return
    const mine = ++search.current
    setFinding(last)
    setScreen('finding')
    findLast(last).then(found => {
      if (mine !== search.current) return
      setFinding(null)
      if (!found) { setScreen('home'); return }
      const pc = { ...last, lastHost: found.host, port: found.port }
      if (found.host !== last.lastHost || found.port !== last.port) updatePc(pc)
      connectTo(pc)
      setScreen('control')
    })
  }

  useEffect(() => {
    // a pairing QR read with the phone's camera app opens El Puntero with the link
    Promise.all([loadStore(), Linking.getInitialURL().catch(() => null)]).then(([, url]) => {
      setReady(true)
      if (url?.startsWith('puntero://pair')) { setIncoming(url); return }
      openLast()
    })
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('puntero://pair')) return
      search.current++
      setFinding(null)
      disconnect(); setScreen('home'); setIncoming(url)
    })
    // back to the app (Android usually keeps it in memory, so this is "opening" it too): from the PCs,
    // to the last one again
    let previous = AppState.currentState
    const appState = AppState.addEventListener('change', next => {
      const wasAway = previous === 'background'
      previous = next
      if (next === 'active' && wasAway && screenRef.current === 'home') openLast()
    })
    return () => { sub.remove(); appState.remove() }
  }, [])

  // Android's back button on the settings goes back to the PCs
  useEffect(() => {
    if (screen !== 'settings') return
    const h = BackHandler.addEventListener('hardwareBackPress', () => { setScreen('home'); return true })
    return () => h.remove()
  }, [screen])

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
            : screen === 'settings'
              ? <SettingsScreen onClose={() => setScreen('home')} />
              : <HomeScreen onOpen={open} onSettings={() => setScreen('settings')} incomingLink={incoming} clearIncoming={() => setIncoming(null)} />)}
      </View>
    </SafeAreaProvider>
  )
}
