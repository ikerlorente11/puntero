// Apps: the PC's open windows (bring to front, minimise, close), its installed apps (open; pinned
// ones first) and web pages (favourites, recent, or type an address or a search).
import { useEffect, useMemo, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { send, useLive } from '../live'
import { getData, updateSettings, useData } from '../store'
import { useTheme } from '../theme'
import { Btn, Card, haptic, Icon, IconName, Segmented } from '../ui'

type Section = 'windows' | 'apps' | 'web'

export function AppsTab() {
  const [section, setSection] = useState<Section>('windows')
  return (
    <View style={{ flex: 1, gap: 12 }}>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'windows', label: 'Abiertas', icon: 'window-restore' },
          { value: 'apps', label: 'Apps', icon: 'apps' },
          { value: 'web', label: 'Web', icon: 'web' },
        ]}
      />
      {section === 'windows' ? <Windows /> : section === 'apps' ? <Apps /> : <Web />}
    </View>
  )
}

function exeIcon(exe: string): IconName {
  const e = exe.toLowerCase()
  if (/chrome|msedge|firefox|brave|opera|vivaldi/.test(e)) return 'web'
  if (e.includes('explorer')) return 'folder-outline'
  if (e.includes('spotify')) return 'spotify'
  if (/vlc|mpc|potplayer|wmplayer/.test(e)) return 'play-circle-outline'
  if (/code|idea|devenv|studio/.test(e)) return 'code-braces'
  if (/word|winword/.test(e)) return 'file-word-outline'
  if (e.includes('excel')) return 'file-excel-outline'
  if (e.includes('powerpnt')) return 'file-powerpoint-outline'
  if (/discord|teams|slack|whatsapp|telegram/.test(e)) return 'chat-outline'
  if (/steam|epic|battle/.test(e)) return 'gamepad-variant-outline'
  return 'application-outline'
}

function Windows() {
  const t = useTheme()
  const { windows, status } = useLive()
  const [refreshing, setRefreshing] = useState(false)
  const refresh = () => { send({ t: 'windows' }); setRefreshing(true); setTimeout(() => setRefreshing(false), 600) }
  useEffect(() => { if (status === 'connected') send({ t: 'windows' }) }, [status])
  return (
    <FlatList
      data={windows ?? []}
      keyExtractor={w => String(w.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} colors={[t.accent]} />}
      contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <Btn icon="view-dashboard-outline" label="Vista de tareas" small style={{ flex: 1 }} onPress={() => send({ t: 'key', k: 'tab', mods: ['win'] })} />
          <Btn icon="monitor" label="Escritorio" small style={{ flex: 1 }} onPress={() => send({ t: 'key', k: 'd', mods: ['win'] })} />
          <Btn icon="swap-horizontal" label="Alt+Tab" small style={{ flex: 1 }} onPress={() => send({ t: 'key', k: 'tab', mods: ['alt'] })} />
        </View>
      }
      ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 20 }}>{windows ? 'No hay ventanas abiertas.' : 'Cargando…'}</Text>}
      renderItem={({ item: w }) => (
        <Pressable
          onPress={() => { haptic(); send({ t: 'win', id: w.id, a: 'focus' }) }}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.raised : t.card, borderColor: w.active ? t.accent : t.line }]}
        >
          <Icon name={exeIcon(w.exe)} size={24} color={w.active ? t.accent : t.muted} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600' }}>{w.title}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{w.exe.replace(/\.exe$/i, '')}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => { haptic(); send({ t: 'win', id: w.id, a: 'minimize' }) }} style={styles.iconBtn}>
            <Icon name="window-minimize" size={20} color={t.muted} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => { haptic(); send({ t: 'win', id: w.id, a: 'close' }) }} style={styles.iconBtn}>
            <Icon name="close" size={22} color={t.danger} />
          </Pressable>
        </Pressable>
      )}
    />
  )
}

function Apps() {
  const t = useTheme()
  const { apps, status } = useLive()
  const { settings } = useData()
  const [query, setQuery] = useState('')
  useEffect(() => { if (status === 'connected' && !apps) send({ t: 'apps' }) }, [status])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    const all = (apps ?? []).filter(a => !q || a.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(q))
    const pinned = all.filter(a => settings.pinnedApps.includes(a.id))
    return [...pinned, ...all.filter(a => !settings.pinnedApps.includes(a.id))]
  }, [apps, query, settings.pinnedApps])
  const togglePin = (id: string) => {
    const pins = getData().settings.pinnedApps
    updateSettings({ pinnedApps: pins.includes(id) ? pins.filter(p => p !== id) : [id, ...pins] })
    haptic()
  }
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar una app del PC"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.line }]}
      />
      <FlatList
        data={list}
        keyExtractor={a => a.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 6, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 20 }}>{apps ? 'Ninguna app con ese nombre.' : 'Pidiendo la lista al PC…'}</Text>}
        renderItem={({ item: a }) => {
          const pinned = settings.pinnedApps.includes(a.id)
          return (
            <Pressable
              onPress={() => { haptic('medium'); send({ t: 'launch', id: a.id }) }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.raised : t.card, borderColor: t.line }]}
            >
              <Icon name="application-outline" size={22} color={t.muted} />
              <Text numberOfLines={1} style={{ color: t.text, flex: 1, fontSize: 15 }}>{a.name}</Text>
              <Pressable hitSlop={10} onPress={() => togglePin(a.id)} style={styles.iconBtn}>
                <Icon name={pinned ? 'pin' : 'pin-outline'} size={20} color={pinned ? t.accent : t.muted} />
              </Pressable>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

function Web() {
  const t = useTheme()
  const { settings } = useData()
  const [url, setUrl] = useState('')
  const open = (u: string) => {
    const value = u.trim()
    if (!value) return
    haptic('medium')
    send({ t: 'url', u: value })
    const recent = [value, ...getData().settings.recentUrls.filter(r => r !== value)].slice(0, 12)
    updateSettings({ recentUrls: recent })
    setUrl('')
  }
  const addFavorite = () => {
    const value = url.trim()
    if (!value) return Alert.alert('Favoritos', 'Escribe primero la dirección que quieres guardar.')
    const name = value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    updateSettings({ favorites: [...getData().settings.favorites, { name, url: value }] })
    setUrl('')
  }
  const removeFavorite = (u: string) => Alert.alert('Quitar de favoritos', u, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: () => updateSettings({ favorites: getData().settings.favorites.filter(f => f.url !== u) }) },
  ])
  return (
    <FlatList
      data={settings.recentUrls}
      keyExtractor={u => u}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              onSubmitEditing={() => open(url)}
              placeholder="Dirección o búsqueda"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              style={[styles.input, { flex: 1, color: t.text, backgroundColor: t.card, borderColor: t.line }]}
            />
            <Btn icon="arrow-right" primary onPress={() => open(url)} style={{ width: 52 }} a11y="Abrir" />
          </View>
          <Card title="Favoritos" right={<Pressable onPress={addFavorite} hitSlop={8}><Icon name="star-plus-outline" size={20} color={t.accent} /></Pressable>}>
            <View style={styles.chips}>
              {settings.favorites.map(f => (
                <Pressable key={f.url} onPress={() => open(f.url)} onLongPress={() => removeFavorite(f.url)}
                  style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? t.accent : t.raised }]}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{f.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: t.muted, fontSize: 12 }}>Mantén pulsado un favorito para quitarlo; la estrella guarda lo escrito arriba.</Text>
          </Card>
          {settings.recentUrls.length > 0 && <Text style={{ color: t.muted, fontWeight: '700', fontSize: 12, letterSpacing: 0.8 }}>RECIENTES</Text>}
        </View>
      }
      renderItem={({ item: u }) => (
        <Pressable onPress={() => open(u)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.raised : t.card, borderColor: t.line }]}>
          <Icon name="history" size={20} color={t.muted} />
          <Text numberOfLines={1} style={{ color: t.text, flex: 1 }}>{u}</Text>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  iconBtn: { padding: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
})
