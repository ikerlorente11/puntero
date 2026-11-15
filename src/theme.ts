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
  /** the selected tab's pill */
  tabOn: string
  amber: string
  ok: string
  warn: string
  danger: string
}

const dark: Theme = {
  dark: true,
  bg: '#0d0e12',
  card: '#16181e',
  raised: '#1f222a',
  pad: '#14161c',
  padLine: '#2b2f3a',
  text: '#eef0f5',
  muted: '#9097a6',
  line: '#252831',
  accent: '#a395ff',
  accentText: '#16112e',
  tabOn: '#252040',
  amber: '#ffb547',
  ok: '#5cd08d',
  warn: '#ffcf6b',
  danger: '#ff7b72',
}

const light: Theme = {
  dark: false,
  bg: '#f4f5f8',
  card: '#ffffff',
  raised: '#eceef3',
  pad: '#eef0f5',
  padLine: '#d3d7e0',
  text: '#15171c',
  muted: '#5c6270',
  line: '#e1e4ea',
  accent: '#5b4bdb',
  accentText: '#ffffff',
  tabOn: '#e9e6fc',
  amber: '#b86e00',
  ok: '#1f8a4c',
  warn: '#9a6a00',
  danger: '#c62828',
}

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark
}
