// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Song } from '../Song.js'

vi.mock('../../adapters/renderer/VexFlowAdapter.js', () => ({
  VexFlowAdapter: {
    render: vi.fn(() => new Map()),
    renderToSVG: vi.fn(() => ({ svg: '<svg></svg>', width: 800, height: 200 })),
  },
}))

describe('Song cursor API', () => {
  let song: Song

  beforeEach(() => {
    song = new Song({ tempo: 120, timeSignature: '4/4' })
    song.add('C4:q D4:q E4:q F4:q')
  })

  it('enableCursor() returns Song for chaining', () => {
    const result = song.enableCursor({ color: '#ff0000', style: 'line' })
    expect(result).toBe(song)
  })

  it('disableCursor() returns Song for chaining', () => {
    song.enableCursor()
    const result = song.disableCursor()
    expect(result).toBe(song)
  })

  it('disableCursor() before enableCursor() does not throw', () => {
    expect(() => song.disableCursor()).not.toThrow()
  })

  it('enableCursor() a second time replaces the previous cursor', () => {
    song.enableCursor({ color: '#ff0000' })
    expect(() => song.enableCursor({ color: '#00ff00' })).not.toThrow()
  })
})
