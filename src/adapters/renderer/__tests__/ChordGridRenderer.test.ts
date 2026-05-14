import { describe, it, expect } from 'vitest'
import {
  ChordGridRenderer,
  type ChordGridOptions,
  extractChordSequence,
} from '../ChordGridRenderer.js'
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'

function makeChordScore(): Score {
  const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
  const part = score.addPart('chords')
  const voice = part.addVoice('chords', 'treble')
  const chords = ['Cmaj7', 'Am7', 'Fmaj7', 'G7']
  for (const sym of chords) {
    const note = new Note({
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'w',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
      chordSymbol: sym,
    })
    voice.addNote(note, score.timeSignature)
  }
  return score
}

describe('extractChordSequence', () => {
  it('returns one chord symbol per measure', () => {
    const score = makeChordScore()
    const seq = extractChordSequence(score)
    expect(seq).toHaveLength(4)
    expect(seq[0]).toBe('Cmaj7')
    expect(seq[1]).toBe('Am7')
    expect(seq[2]).toBe('Fmaj7')
    expect(seq[3]).toBe('G7')
  })
  it('returns empty string for measures with no chord symbol', () => {
    const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
    const part = score.addPart('p')
    const voice = part.addVoice('v', 'treble')
    const note = new Note({
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'w',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
    })
    voice.addNote(note, score.timeSignature)
    const seq = extractChordSequence(score)
    expect(seq).toHaveLength(1)
    expect(seq[0]).toBe('')
  })
})

describe('ChordGridRenderer.render', () => {
  it('returns a string containing svg element', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
  it('contains chord symbol text for each measure', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('Cmaj7')
    expect(svg).toContain('Am7')
    expect(svg).toContain('Fmaj7')
    expect(svg).toContain('G7')
  })
  it('respects cellsPerRow option — 2 rows of 2 cells at cellHeight 80 = height 160', () => {
    const score = makeChordScore()
    const opts: ChordGridOptions = { cellsPerRow: 2, cellWidth: 100, cellHeight: 80 }
    const svg = ChordGridRenderer.render(score, opts)
    expect(svg).toContain('height="160"')
  })
  it('renders bar numbers when showBarNumbers is true', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score, { showBarNumbers: true })
    expect(svg).toContain('>1<')
    expect(svg).toContain('>2<')
  })
  it('renders rhythm slash characters inside each cell', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('/')
  })
})
