import { describe, it, expect } from 'vitest'
import { Note } from '../Note.js'
import { NoteData } from '../types.js'

function makeNote(overrides: Partial<NoteData> = {}): Note {
  const defaults: NoteData = {
    pitch: 'C',
    accidental: null,
    octave: 4,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    chord: false,
  }
  return new Note({ ...defaults, ...overrides })
}

describe('Note construction', () => {
  it('creates a valid note with defaults', () => {
    const n = makeNote()
    expect(n.pitch).toBe('C')
    expect(n.octave).toBe(4)
    expect(n.duration).toBe('q')
    expect(n.dotted).toBe(false)
    expect(n.dynamic).toBeNull()
    expect(n.tied).toBe(false)
    expect(n.slurred).toBe(false)
    expect(n.chord).toBe(false)
  })

  it('stores all provided properties', () => {
    const n = makeNote({
      pitch: 'G',
      accidental: '#',
      octave: 5,
      duration: 'e',
      dotted: true,
      dynamic: 'ff',
      tied: true,
      slurred: true,
      chord: true,
    })
    expect(n.pitch).toBe('G')
    expect(n.accidental).toBe('#')
    expect(n.octave).toBe(5)
    expect(n.duration).toBe('e')
    expect(n.dotted).toBe(true)
    expect(n.dynamic).toBe('ff')
    expect(n.tied).toBe(true)
    expect(n.slurred).toBe(true)
    expect(n.chord).toBe(true)
  })
})

describe('Note.beats', () => {
  const durationBeats: [string, number][] = [
    ['w', 4],
    ['h', 2],
    ['q', 1],
    ['e', 0.5],
    ['s', 0.25],
    ['t', 0.125],
  ]

  durationBeats.forEach(([dur, expected]) => {
    it(`${dur} note = ${expected} beats`, () => {
      const n = makeNote({ duration: dur as NoteData['duration'] })
      expect(n.beats).toBe(expected)
    })
  })

  it('dotted quarter = 1.5 beats', () => {
    expect(makeNote({ duration: 'q', dotted: true }).beats).toBe(1.5)
  })
  it('dotted half = 3 beats', () => {
    expect(makeNote({ duration: 'h', dotted: true }).beats).toBe(3)
  })
})

describe('Note.isRest', () => {
  it('isRest = false for pitched note', () => {
    expect(makeNote({ pitch: 'C' }).isRest).toBe(false)
  })
  it('isRest = true for rest (R)', () => {
    expect(makeNote({ pitch: 'R' }).isRest).toBe(true)
  })
})

describe('Note.midi', () => {
  it('C4 = MIDI 60', () => {
    expect(makeNote({ pitch: 'C', accidental: null, octave: 4 }).midi).toBe(60)
  })
  it('A4 = MIDI 69', () => {
    expect(makeNote({ pitch: 'A', accidental: null, octave: 4 }).midi).toBe(69)
  })
  it('C#4 = MIDI 61', () => {
    expect(makeNote({ pitch: 'C', accidental: '#', octave: 4 }).midi).toBe(61)
  })
  it('F#5 = MIDI 78', () => {
    expect(makeNote({ pitch: 'F', accidental: '#', octave: 5 }).midi).toBe(78)
  })
  it('Bb3 = MIDI 58', () => {
    expect(makeNote({ pitch: 'B', accidental: 'b', octave: 3 }).midi).toBe(58)
  })
  it('rest returns null midi', () => {
    expect(makeNote({ pitch: 'R' }).midi).toBeNull()
  })
})

describe('Note.frequency', () => {
  it('A4 = 440 Hz', () => {
    expect(makeNote({ pitch: 'A', accidental: null, octave: 4 }).frequency).toBe(440)
  })
  it('C4 ≈ 261.63 Hz', () => {
    expect(makeNote({ pitch: 'C', accidental: null, octave: 4 }).frequency).toBeCloseTo(261.63, 1)
  })
  it('rest returns null frequency', () => {
    expect(makeNote({ pitch: 'R' }).frequency).toBeNull()
  })
})
