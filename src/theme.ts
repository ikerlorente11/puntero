import { useColorScheme } from 'react-native'

export interface Theme {
  dark: boolean
  bg: string
  card: string
  raised: string
  pad: string
  padLine: string
  text: string
  muted: string
  line: string
  accent: string
  accentText: string
  amber: string
  ok: string
  warn: string
  danger: string
}

const dark: Theme = {
  dark: true,
  bg: '#0f1024',
  card: '#1a1c3a',
  raised: '#252851',
  pad: '#15173a',
  padLine: '#2c3070',
  text: '#eceefe',
  muted: '#9a9dc4',
  line: '#2c2f5c',
  accent: '#ffb547',
  accentText: '#1a1300',
  amber: '#ffb547',
  ok: '#5cd08d',
  warn: '#ffcf6b',
  danger: '#ff7b72',
}

const light: Theme = {
  dark: false,
  bg: '#f2f2f8',
  card: '#ffffff',
  raised: '#e8e9f5',
  pad: '#e4e6f6',
  padLine: '#c5c8ea',
  text: '#16173a',
  muted: '#5d5f86',
  line: '#dcdcee',
  accent: '#2b2f77',
  accentText: '#ffffff',
  amber: '#c27a00',
  ok: '#1f8a4c',
  warn: '#9a6a00',
  danger: '#c62828',
}

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark
}
