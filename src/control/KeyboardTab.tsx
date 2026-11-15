// The keyboard. "En directo": what is typed on the phone's keyboard appears on the PC as it is typed
// (autocorrect, swipe typing and dictation included, see core/typing.ts). "Redactar": write it all
// first and send it in one go (long texts, passwords). Ctrl/Alt/Shift/Win stay pressed for the next
// key, like the sticky keys of Windows. Below, the keys a phone keyboard lacks.
import * as Clipboard from 'expo-clipboard'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native'
import { typingCommands } from '../core/typing'
import { send } from '../live'
import { useTheme } from '../theme'
import { Btn, Card, Grid, haptic, Segmented } from '../ui'

const MODS = [
  { k: 'ctrl', label: 'Ctrl' },
  { k: 'alt', label: 'Alt' },
  { k: 'shift', label: 'Mayús' },
  { k: 'win', label: 'Win' },
]

export function KeyboardTab() {
  const t = useTheme()
  const [mode, setMode] = useState<'live' | 'compose'>('live')
  const [buffer, setBuffer] = useState('')
  const [draft, setDraft] = useState('')
  const [mods, setMods] = useState<string[]>([])
  const [fkeys, setFkeys] = useState(false)
  const input = useRef<TextInputInstance>(null)

  const key = (k: string, extra: string[] = []) => {
    haptic()
    send({ t: 'key', k, mods: [...mods, ...extra] })
    if (mods.length) setMods([])
  }

  const onLive = (next: string) => {
    // with a modifier held, a typed letter is a shortcut (Ctrl+C...), not text
    if (mods.length) {
      const typed = next.slice(buffer.length)
      const ch = typed.slice(-1).toLowerCase()
      if (ch && /^[a-z0-9]$/.test(ch)) key(ch)
      else if (ch === ' ') key('space')
      setBuffer(buffer)
      return
    }
    for (const c of typingCommands(buffer, next)) send(c)
    // a long line is forgotten from time to time (the PC keeps it; the field only needs the end)
    setBuffer(next.length > 400 ? '' : next)
  }

  const toggleMod = (k: string) => {
    haptic()
    setMods(m => (m.includes(k) ? m.filter(x => x !== k) : [...m, k]))
    input.current?.focus()
  }

  const pastePhone = async () => {
    const text = await Clipboard.getStringAsync()
    if (!text) return
    send({ t: 'clip', s: text })
    setTimeout(() => send({ t: 'key', k: 'v', mods: ['ctrl'] }), 150)
    haptic()
  }

  return (
    <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[{ value: 'live', label: 'En directo', icon: 'keyboard-outline' }, { value: 'compose', label: 'Redactar', icon: 'text-box-edit-outline' }]}
      />
      {mode === 'live' ? (
        <View style={[styles.live, { backgroundColor: t.card, borderColor: mods.length ? t.accent : t.line }]}>
          <TextInput
            ref={input}
            value={buffer}
            onChangeText={onLive}
            onKeyPress={e => { if (e.nativeEvent.key === 'Backspace' && buffer === '') key('backspace') }}
            onSubmitEditing={() => { key('enter'); setBuffer('') }}
            submitBehavior="submit"
            autoFocus
            autoCapitalize="none"
            placeholder={mods.length ? `${mods.join(' + ')} + …` : 'Escribe y aparece en el PC'}
            placeholderTextColor={t.muted}
            style={[styles.liveInput, { color: t.text }]}
          />
          <Btn icon="backspace-outline" small onPress={() => key('backspace')} a11y="Borrar" style={{ width: 52 }} />
        </View>
      ) : (
        <Card>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Escribe aquí y envíalo de una vez"
            placeholderTextColor={t.muted}
            style={[styles.compose, { color: t.text, borderColor: t.line }]}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn icon="send" label="Escribir en el PC" primary style={{ flex: 2 }} disabled={!draft} onPress={() => { send({ t: 'text', s: draft }); setDraft('') }} />
            <Btn icon="keyboard-return" label="Y pulsar Intro" style={{ flex: 1.5 }} disabled={!draft} onPress={() => { send({ t: 'text', s: draft + '\n' }); setDraft('') }} />
          </View>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {MODS.map(m => <Btn key={m.k} label={m.label} small active={mods.includes(m.k)} onPress={() => toggleMod(m.k)} style={{ flex: 1 }} />)}
      </View>

      <Card>
        <Grid cols={4}>
          <Btn label="Esc" small onPress={() => key('esc')} />
          <Btn label="Tab" small onPress={() => key('tab')} />
          <Btn label="Supr" small onPress={() => key('delete')} />
          <Btn icon="keyboard-return" small onPress={() => key('enter')} a11y="Intro" />
          <Btn label="Inicio" small onPress={() => key('home')} />
          <Btn icon="chevron-up" small onPress={() => key('up')} a11y="Arriba" />
          <Btn label="Fin" small onPress={() => key('end')} />
          <Btn label="RePág" small onPress={() => key('pageup')} />
          <Btn icon="chevron-left" small onPress={() => key('left')} a11y="Izquierda" />
          <Btn icon="chevron-down" small onPress={() => key('down')} a11y="Abajo" />
          <Btn icon="chevron-right" small onPress={() => key('right')} a11y="Derecha" />
          <Btn label="AvPág" small onPress={() => key('pagedown')} />
        </Grid>
        <Grid cols={3}>
          <Btn icon="microsoft-windows" label="Inicio" small onPress={() => key('win')} />
          <Btn icon="monitor-screenshot" label="Recorte" small onPress={() => send({ t: 'key', k: 's', mods: ['win', 'shift'] })} />
          <Btn icon="function-variant" label="F1–F12" small active={fkeys} onPress={() => setFkeys(f => !f)} />
        </Grid>
        {fkeys && (
          <Grid cols={6}>
            {Array.from({ length: 12 }, (_, i) => <Btn key={i} label={`F${i + 1}`} small onPress={() => key(`f${i + 1}`)} />)}
          </Grid>
        )}
      </Card>

      <Card title="Atajos de texto">
        <Grid cols={3}>
          <Btn icon="content-copy" label="Copiar" small onPress={() => send({ t: 'key', k: 'c', mods: ['ctrl'] })} />
          <Btn icon="content-paste" label="Pegar" small onPress={() => send({ t: 'key', k: 'v', mods: ['ctrl'] })} />
          <Btn icon="content-cut" label="Cortar" small onPress={() => send({ t: 'key', k: 'x', mods: ['ctrl'] })} />
          <Btn icon="undo" label="Deshacer" small onPress={() => send({ t: 'key', k: 'z', mods: ['ctrl'] })} />
          <Btn icon="redo" label="Rehacer" small onPress={() => send({ t: 'key', k: 'y', mods: ['ctrl'] })} />
          <Btn icon="select-all" label="Todo" small onPress={() => send({ t: 'key', k: 'a', mods: ['ctrl'] })} />
        </Grid>
        <Btn icon="cellphone-arrow-down" label="Pegar en el PC lo copiado en el móvil" onPress={pastePhone} />
        <Text style={{ color: t.muted, fontSize: 12 }}>
          Consejo: el micrófono del teclado del móvil también funciona, y lo dictado aparece en el PC.
        </Text>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1.5, padding: 6, paddingLeft: 14 },
  liveInput: { flex: 1, fontSize: 18, paddingVertical: 10 },
  compose: { minHeight: 110, fontSize: 16, textAlignVertical: 'top', borderWidth: 1, borderRadius: 12, padding: 12 },
})
