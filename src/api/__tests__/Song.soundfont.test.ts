// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { Song } from '../Song.js'

vi.mock('../../adapters/audio/SoundfontAdapter.js', () => ({
  SoundfontAdapter: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}))

describe('Song.useInstrument', () => {
  it('returns Song for chaining', () => {
    const song = new Song({ tempo: 120 })
    const result = song.useInstrument('violin', { soundfont: 'FluidR3_GM' })
    expect(result).toBe(song)
  })

  it('does not throw when called before add()', () => {
    const song = new Song()
    expect(() => song.useInstrument('piano')).not.toThrow()
  })

  it('useInstrument with empty options does not throw', () => {
    const song = new Song()
    expect(() => song.useInstrument('piano', {})).not.toThrow()
  })

  it('useInstrument without options uses ToneAdapter (default)', () => {
    const song = new Song()
    // Just verify it doesn't crash — ToneAdapter is default
    expect(() => song.useInstrument('piano')).not.toThrow()
  })
})
