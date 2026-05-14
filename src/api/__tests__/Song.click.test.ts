// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Song } from '../Song.js'

vi.mock('../../adapters/renderer/VexFlowAdapter.js', () => ({
  VexFlowAdapter: {
    render: vi.fn(() => new Map()),
    renderToSVG: vi.fn(() => ({ svg: '<svg></svg>', width: 800, height: 200 })),
  },
}))

describe('Song click handler', () => {
  let song: Song

  beforeEach(() => {
    song = new Song({ tempo: 120, timeSignature: '4/4' })
    song.add('C4:q D4:q E4:q F4:q')
  })

  it('onClick() returns Song for chaining', () => {
    const result = song.onClick(vi.fn())
    expect(result).toBe(song)
  })

  it('getSelectedNote() returns null before any click', () => {
    expect(song.getSelectedNote()).toBeNull()
  })

  it('clearSelection() returns Song for chaining', () => {
    expect(song.clearSelection()).toBe(song)
  })

  it('clearSelection() when nothing selected does not throw', () => {
    expect(() => song.clearSelection()).not.toThrow()
  })

  it('multiple onClick() handlers can be registered', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    song.onClick(h1)
    song.onClick(h2)
    // Both registered without error
    expect(song.getSelectedNote()).toBeNull()
  })
})
