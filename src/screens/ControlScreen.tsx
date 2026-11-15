// Controlling one PC: a header with its name and the connection, the five tabs and the tab bar.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Dimensions, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppsTab } from '../control/AppsTab'
import { KeyboardTab } from '../control/KeyboardTab'
import { MediaTab } from '../control/MediaTab'
import { MoreTab } from '../control/MoreTab'
import { MouseTab } from '../control/MouseTab'
import { retry, useLive } from '../live'
import { useData } from '../store'
import { useTheme } from '../theme'
import { haptic, Icon, IconName } from '../ui'

type Tab = 'mouse' | 'keyboard' | 'media' | 'apps' | 'more'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'mouse', label: 'Ratón', icon: 'mouse' },
  { id: 'keyboard', label: 'Teclado', icon: 'keyboard-outline' },
  { id: 'media', label: 'Multimedia', icon: 'play-circle-outline' },
  { id: 'apps', label: 'Apps', icon: 'apps' },
  { id: 'more', label: 'Más', icon: 'dots-horizontal-circle-outline' },
]

export function ControlScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { pc, status, error, notice } = useLive()
  const { settings } = useData()
  const [tab, setTab] = useState<Tab>('mouse')
  const window = useWindowDimensions()
  const wide = window.width >= 760 && window.width > window.height
  const [air, setAir] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // with the phone's keyboard open the tab bar steps aside: the room is for the touchpad
  const [typing, setTyping] = useState(false)
  // On Android 15 (edge to edge) the window no longer shrinks for the keyboard, which then covers
  // the touchpad: if the window kept its height, the keyboard's room is left free by hand
  const [keyboardRoom, setKeyboardRoom] = useState(0)
  const bottomInset = useRef(insets.bottom)
  bottomInset.current = insets.bottom
  useEffect(() => {
    let closedHeight = Dimensions.get('window').height
    let timer: ReturnType<typeof setTimeout> | null = null
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setTyping(true)
      const keyboard = e.endCoordinates.height
      timer = setTimeout(() => {
        const shrunk = closedHeight - Dimensions.get('window').height > keyboard / 2
        // (the keyboard's height leaves out the navigation bar under it)
        setKeyboardRoom(shrunk ? 0 : keyboard + bottomInset.current)
      }, 120)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (timer) clearTimeout(timer)
      setTyping(false)
      setKeyboardRoom(0)
      setTimeout(() => { closedHeight = Dimensions.get('window').height }, 200)
    })
    return () => { show.remove(); hide.remove(); if (timer) clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'mouse') { setTab('mouse'); return true }
      onBack()
      return true
    })
    return () => sub.remove()
  }, [tab])

  useEffect(() => {
    if (!settings.keepAwake) return
    activateKeepAwakeAsync('control').catch(() => {})
    return () => { deactivateKeepAwake('control').catch(() => {}) }
  }, [settings.keepAwake])

  useEffect(() => {
    if (!notice) return
    setToast(notice.msg)
    const h = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(h)
  }, [notice])


  const dot = status === 'connected' ? t.ok : status === 'failed' ? t.danger : t.warn
  const line = status === 'connected' ? 'Conectado' : status === 'failed' ? (error ?? 'Sin conexión') : error ? `Conectando… ${error}` : 'Conectando…'

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Volver a los PCs">
          <Icon name="arrow-left" />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={status === 'connected' ? undefined : retry}>
          <Text numberOfLines={1} style={[styles.pcName, { color: t.text }]}>{pc?.name ?? 'PC'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12, flex: 1 }}>{line}</Text>
          </View>
        </Pressable>
        {(
          <Pressable
            onPress={() => { haptic('medium'); setAir(a => !a) }}
            style={[styles.airBtn, { backgroundColor: air ? t.amber : t.raised }]}
            accessibilityLabel="Modo aire: mover el puntero girando el móvil"
          >
            <Icon name="rotate-3d-variant" size={20} color={air ? '#1a1300' : t.text} />
            <Text style={{ color: air ? '#1a1300' : t.text, fontWeight: '700' }}>Aire</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 4, opacity: status === 'connected' ? 1 : 0.55 }}>
        {tab === 'mouse' ? <MouseTab air={air} /> : (
          // the pointer is always at hand: a small touchpad under every other tab, or beside it on a
          // wide screen (a tablet or a phone on its side), where it can be as tall as the screen
          <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: wide ? 12 : 0 }}>
            <View style={wide ? { flex: 1, maxWidth: 620 } : { flex: 1 }}>
              {tab === 'keyboard' && <KeyboardTab />}
              {tab === 'media' && <MediaTab />}
              {tab === 'apps' && <AppsTab />}
              {tab === 'more' && <MoreTab onLeave={onBack} />}
            </View>
            <View style={wide ? { flex: 1, paddingBottom: 4 } : { height: settings.showButtons ? 196 : 140, paddingTop: 10 }}>
              <MouseTab air={air} compact={!wide} />
            </View>
          </View>
        )}
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.raised, top: insets.top + 64 }]}>
          <Text style={{ color: t.text }}>{toast}</Text>
        </View>
      )}

      {!typing && <View style={[styles.tabs, { paddingBottom: insets.bottom + 6, borderTopColor: t.line, backgroundColor: t.card }]}>
        {TABS.map(item => {
          const on = item.id === tab
          return (
            <Pressable key={item.id} onPress={() => { haptic(); setTab(item.id) }} style={[styles.tab, on && { backgroundColor: t.tabOn }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Icon name={item.icon} size={22} color={on ? t.accent : t.muted} />
              <Text numberOfLines={1} style={{ color: on ? t.text : t.muted, fontSize: 11, fontWeight: on ? '700' : '500' }}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>}
      {typing && <View style={{ height: 8 + keyboardRoom }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerBtn: { padding: 6 },
  pcName: { fontSize: 17, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  airBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 6, marginTop: 10, gap: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 7, borderRadius: 18, borderCurve: 'continuous' },
  toast: { position: 'absolute', left: 20, right: 20, padding: 12, borderRadius: 12, alignItems: 'center' },
})
