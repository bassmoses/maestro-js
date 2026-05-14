// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Song } from '../Song.js'

describe('Song.renderChordGrid', () => {
  it('injects SVG into target element', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Cmaj7" C4:w | @"Am7" A3:w | @"Fmaj7" F3:w | @"G7" G3:w')
    song.renderChordGrid(div)
    expect(div.innerHTML).toContain('<svg')
    expect(div.innerHTML).toContain('Cmaj7')
    document.body.removeChild(div)
  })
  it('accepts a CSS selector string', () => {
    const div = document.createElement('div')
    div.id = 'chord-grid-test'
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Dm7" D4:w | @"G7" G3:w')
    song.renderChordGrid('#chord-grid-test')
    expect(div.innerHTML).toContain('Dm7')
    document.body.removeChild(div)
  })
  it('throws when target not found', () => {
    const song = new Song()
    song.add('C4:q')
    expect(() => song.renderChordGrid('#does-not-exist')).toThrow()
  })
  it('accepts ChordGridOptions', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Cmaj7" C4:w | @"Dm7" D4:w | @"Em7" E4:w | @"Fmaj7" F4:w')
    song.renderChordGrid(div, { cellsPerRow: 2, showBarNumbers: true })
    expect(div.innerHTML).toContain('>1<')
    document.body.removeChild(div)
  })
  it('returns this for chaining', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"C" C4:w')
    const result = song.renderChordGrid(div)
    expect(result).toBe(song)
    document.body.removeChild(div)
  })
})
