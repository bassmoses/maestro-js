export interface RenderOptions {
  width?: number
  height?: number
  measuresPerLine?: number
  theme?: 'light' | 'dark'
  showDynamics?: boolean
  showBarNumbers?: boolean
  showPartNames?: boolean
  partNameStyle?: 'full' | 'abbreviated'
  grandStaff?: boolean
  padding?: number
}

export const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  width: 800,
  height: 0, // auto
  measuresPerLine: 4,
  theme: 'light',
  showDynamics: true,
  showBarNumbers: true,
  showPartNames: true,
  partNameStyle: 'abbreviated',
  grandStaff: false,
  padding: 20,
}

export interface ThemeColors {
  background: string
  foreground: string
  staveColor: string
  noteColor: string
  dynamicColor: string
  titleColor: string
}

export const THEMES: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#ffffff',
    foreground: '#000000',
    staveColor: '#000000',
    noteColor: '#000000',
    dynamicColor: '#0000cc',
    titleColor: '#000000',
  },
  dark: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    staveColor: '#d4d4d4',
    noteColor: '#d4d4d4',
    dynamicColor: '#6699cc',
    titleColor: '#d4d4d4',
  },
}
