import { describe, it, expect } from 'vitest'
import { DEFAULT_RENDER_OPTIONS, THEMES } from '../types.js'

describe('Renderer types', () => {
  describe('DEFAULT_RENDER_OPTIONS', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_RENDER_OPTIONS.width).toBe(800)
      expect(DEFAULT_RENDER_OPTIONS.measuresPerLine).toBe(4)
      expect(DEFAULT_RENDER_OPTIONS.theme).toBe('light')
      expect(DEFAULT_RENDER_OPTIONS.showDynamics).toBe(true)
      expect(DEFAULT_RENDER_OPTIONS.showBarNumbers).toBe(true)
      expect(DEFAULT_RENDER_OPTIONS.grandStaff).toBe(false)
      expect(DEFAULT_RENDER_OPTIONS.padding).toBe(20)
    })
  })

  describe('THEMES', () => {
    it('has light and dark themes', () => {
      expect(THEMES.light).toBeDefined()
      expect(THEMES.dark).toBeDefined()
    })

    it('light theme has white background', () => {
      expect(THEMES.light.background).toBe('#ffffff')
      expect(THEMES.light.foreground).toBe('#000000')
    })

    it('dark theme has dark background', () => {
      expect(THEMES.dark.background).toBe('#1e1e1e')
      expect(THEMES.dark.foreground).toBe('#d4d4d4')
    })

    it('themes have all required properties', () => {
      for (const theme of [THEMES.light, THEMES.dark]) {
        expect(theme).toHaveProperty('background')
        expect(theme).toHaveProperty('foreground')
        expect(theme).toHaveProperty('staveColor')
        expect(theme).toHaveProperty('noteColor')
        expect(theme).toHaveProperty('dynamicColor')
        expect(theme).toHaveProperty('titleColor')
      }
    })
  })
})
