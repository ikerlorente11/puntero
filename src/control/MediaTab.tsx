// Media: play/pause and tracks (any player that listens to the media keys: Spotify, YouTube in the
// browser, VLC...), the PC's volume (in sync with the PC), and the keys of videos and presentations.
import Slider from '@react-native-community/slider'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { send, useLive } from '../live'
import { useTheme } from '../theme'
import { Btn, Card, Grid, haptic, Icon } from '../ui'

const key = (k: string, mods: string[] = []) => { haptic(); send({ t: 'key', k, mods }) }

export function MediaTab() {
  const t = useTheme()
  const { vol, status } = useLive()
  const [level, setLevel] = useState<number | null>(null)
  const sliding = useRef(false)
  const lastSent = useRef(0)

  useEffect(() => { if (status === 'connected') send({ t: 'vol' }) }, [status])
  useEffect(() => { if (vol && !sliding.current) setLevel(vol.v) }, [vol])

  const setVolume = (v: number, final = false) => {
    setLevel(v)
    const now = Date.now()
    if (final || now - lastSent.current > 80) { lastSent.current = now; send({ t: 'vol', v }) }
  }

  const pct = level == null ? '—' : `${Math.round(level * 100)}`

  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn icon="skip-previous" big onPress={() => key('prev')} style={{ flex: 1 }} a11y="Anterior" />
          <Btn icon="play-pause" big primary onPress={() => key('playpause')} style={{ flex: 1.4 }} a11y="Reproducir o pausar" />
          <Btn icon="skip-next" big onPress={() => key('next')} style={{ flex: 1 }} a11y="Siguiente" />
        </View>
      </Card>

      <Card title="Volumen del PC" right={<Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{vol?.mute ? 'Silencio' : pct}</Text>}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Btn icon={vol?.mute ? 'volume-off' : 'volume-high'} active={!!vol?.mute} onPress={() => send({ t: 'vol', mute: !vol?.mute })} style={{ width: 56 }} a11y="Silenciar" />
          <Slider
            style={{ flex: 1, height: 44 }}
            value={level ?? 0}
            minimumValue={0}
            maximumValue={1}
            onSlidingStart={() => { sliding.current = true }}
            onValueChange={v => setVolume(v)}
            onSlidingComplete={v => { sliding.current = false; setVolume(v, true) }}
            minimumTrackTintColor={t.accent}
            maximumTrackTintColor={t.line}
            thumbTintColor={t.accent}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn icon="volume-minus" label="Bajar" onPress={() => key('voldown')} style={{ flex: 1 }} />
          <Btn icon="volume-plus" label="Subir" onPress={() => key('volup')} style={{ flex: 1 }} />
        </View>
      </Card>

      <Card title="Vídeo (YouTube, Netflix, VLC…)">
        <Grid cols={3}>
          <Btn icon="rewind" label="Atrás" onPress={() => key('left')} />
          <Btn icon="play-pause" label="Pausa" onPress={() => key('space')} />
          <Btn icon="fast-forward" label="Adelante" onPress={() => key('right')} />
          <Btn icon="fullscreen" label="Completa" onPress={() => key('f')} />
          <Btn icon="subtitles-outline" label="Subtítulos" onPress={() => key('c')} />
          <Btn icon="volume-mute" label="Silencio" onPress={() => key('m')} />
        </Grid>
      </Card>

      <Card title="Presentación (PowerPoint, PDF…)">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn icon="chevron-left" big onPress={() => key('left')} style={{ flex: 1 }} a11y="Diapositiva anterior" />
          <Btn icon="chevron-right" big primary onPress={() => key('right')} style={{ flex: 1.6 }} a11y="Diapositiva siguiente" />
        </View>
        <Grid cols={4}>
          <Btn icon="presentation-play" label="Empezar" small onPress={() => key('f5')} />
          <Btn icon="play-box-outline" label="Desde aquí" small onPress={() => key('f5', ['shift'])} />
          <Btn icon="square" label="Negro" small onPress={() => key('b')} />
          <Btn icon="close" label="Salir" small onPress={() => key('esc')} />
        </Grid>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="information-outline" size={16} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>Con el modo aire (botón Aire, arriba), el móvil hace de puntero láser.</Text>
        </View>
      </Card>
    </ScrollView>
  )
}
