// Small shared pieces: buttons, cards, rows with switches and sliders, haptics.
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import { ReactNode } from 'react'
import { Pressable, StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native'
import { getData } from './store'
import { useTheme } from './theme'

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap

let lastTick = 0
export function haptic(kind: 'light' | 'medium' | 'tick' = 'light') {
  if (!getData().settings.haptics) return
  if (kind === 'tick') {
    const now = Date.now()
    if (now - lastTick < 35) return
    lastTick = now
    Haptics.selectionAsync().catch(() => {})
    return
  }
  Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme()
  return <MaterialCommunityIcons name={name} size={size} color={color ?? t.text} />
}

interface BtnProps {
  icon?: IconName
  label?: string
  onPress?: () => void
  onPressIn?: () => void
  onPressOut?: () => void
  onLongPress?: () => void
  primary?: boolean
  danger?: boolean
  active?: boolean
  big?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  a11y?: string
}

export function Btn({ icon, label, onPress, onPressIn, onPressOut, onLongPress, primary, danger, active, big, small, style, disabled, a11y }: BtnProps) {
  const t = useTheme()
  const bg = primary || active ? t.accent : t.raised
  const fg = primary || active ? t.accentText : danger ? t.danger : t.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      disabled={disabled}
      onPress={onPress ? () => { haptic(); onPress() } : undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1, paddingVertical: big ? 18 : small ? 6 : 11 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={big ? 30 : small ? 18 : 22} color={fg} />}
      {label ? <Text numberOfLines={1} style={[styles.btnLabel, { color: fg, fontSize: small ? 12 : 13 }]}>{label}</Text> : null}
    </Pressable>
  )
}

export function Card({ title, children, right, style }: { title?: string; children: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }, style]}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: t.muted }]}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  )
}

export function Grid({ children, cols = 3 }: { children: ReactNode; cols?: number }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children]
  const rows: ReactNode[][] = []
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((item, j) => <View key={j} style={{ flex: 1 }}>{item}</View>)}
          {Array.from({ length: cols - row.length }, (_, j) => <View key={`e${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  )
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme()
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} thumbColor={t.dark ? '#fff' : undefined} />
    </View>
  )
}

export function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string
}) {
  const t = useTheme()
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: t.muted }}>{format ? format(value) : value.toFixed(1)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onSlidingComplete={onChange}
        minimumTrackTintColor={t.accent}
        maximumTrackTintColor={t.line}
        thumbTintColor={t.accent}
      />
    </View>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  const t = useTheme()
  return (
    <View style={[styles.segmented, { backgroundColor: t.raised }]}>
      {options.map(o => {
        const on = o.value === value
        return (
          <Pressable key={o.value} onPress={() => { haptic(); onChange(o.value) }} style={[styles.segment, on && { backgroundColor: t.accent }]}>
            {o.icon && <Icon name={o.icon} size={18} color={on ? t.accentText : t.muted} />}
            <Text style={{ color: on ? t.accentText : t.muted, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 4, minHeight: 44 },
  btnLabel: { fontWeight: '600' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
})
