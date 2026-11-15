// El Puntero: control a Windows PC's mouse and keyboard from the phone. Two screens: the PCs (pair,
// pick) and the control of one PC. The last PC used opens straight away.
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Pc } from './src/core/client'
import { connectTo, disconnect } from './src/live'
import { ControlScreen } from './src/screens/ControlScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { Data, loadStore, update } from './src/store'
import { useTheme } from './src/theme'

export default function App() {
  const t = useTheme()
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<'home' | 'control'>('home')
  const [incoming, setIncoming] = useState<string | null>(null)

  useEffect(() => {
    loadStore().then((data: Data) => {
      const last = data.pcs.find(p => p.id === data.lastPc)
      if (last) { connectTo(last); setScreen('control') }
      setReady(true)
    })
    // a pairing QR read with the phone's camera app opens El Puntero with the link
    Linking.getInitialURL().then(url => { if (url?.startsWith('puntero://pair')) setIncoming(url) })
    const sub = Linking.addEventListener('url', ({ url }) => { if (url.startsWith('puntero://pair')) { disconnect(); setScreen('home'); setIncoming(url) } })
    return () => sub.remove()
  }, [])

  const open = (pc: Pc) => {
    update(d => ({ ...d, lastPc: pc.id }))
    connectTo(pc)
    setScreen('control')
  }

  const back = () => {
    disconnect()
    update(d => ({ ...d, lastPc: null }))
    setScreen('home')
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {ready && (screen === 'home'
          ? <HomeScreen onOpen={open} incomingLink={incoming} clearIncoming={() => setIncoming(null)} />
          : <ControlScreen onBack={back} />)}
      </View>
    </SafeAreaProvider>
  )
}
