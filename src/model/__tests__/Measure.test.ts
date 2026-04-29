import { describe, it, expect, beforeEach } from 'vitest'
import { Measure } from '../Measure.js'
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

describe('Measure (4/4)', () => {
  let measure: Measure

  beforeEach(() => {
    measure = new Measure({ beats: 4, noteValue: 'q' })
  })

  it('starts empty: totalBeats = 0', () => {
    expect(measure.totalBeats).toBe(0)
  })

  it('starts with 4 beatsRemaining', () => {
    expect(measure.beatsRemaining).toBe(4)
  })

  it('is not full when empty', () => {
    expect(measure.isFull).toBe(false)
  })

  it('4 quarter notes fills it', () => {
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    expect(measure.isFull).toBe(true)
    expect(measure.totalBeats).toBe(4)
    expect(measure.beatsRemaining).toBe(0)
  })

  it('adding a 5th quarter note throws', () => {
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    expect(() => measure.addNote(makeNote({ duration: 'q' }))).toThrow()
  })

  it('1 whole note fills it', () => {
    measure.addNote(makeNote({ duration: 'w' }))
    expect(measure.isFull).toBe(true)
  })

  it('2 half notes fills it', () => {
    measure.addNote(makeNote({ duration: 'h' }))
    measure.addNote(makeNote({ duration: 'h' }))
    expect(measure.isFull).toBe(true)
  })

  it('beatsRemaining updates after adding notes', () => {
    measure.addNote(makeNote({ duration: 'q' }))
    expect(measure.beatsRemaining).toBe(3)
    measure.addNote(makeNote({ duration: 'h' }))
    expect(measure.beatsRemaining).toBe(1)
  })

  it('getNotes returns all added notes', () => {
    const n1 = makeNote({ duration: 'h' })
    const n2 = makeNote({ duration: 'q' })
    measure.addNote(n1)
    measure.addNote(n2)
    expect(measure.getNotes()).toEqual([n1, n2])
  })
})

describe('Measure (3/4)', () => {
  let measure: Measure

  beforeEach(() => {
    measure = new Measure({ beats: 3, noteValue: 'q' })
  })

  it('has 3 beats capacity', () => {
    expect(measure.beatsRemaining).toBe(3)
  })

  it('3 quarter notes fills it', () => {
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    expect(measure.isFull).toBe(true)
  })

  it('adding 4th quarter note to 3/4 measure throws', () => {
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    measure.addNote(makeNote({ duration: 'q' }))
    expect(() => measure.addNote(makeNote({ duration: 'q' }))).toThrow()
  })
})

describe('Measure (6/8)', () => {
  let measure: Measure

  beforeEach(() => {
    measure = new Measure({ beats: 6, noteValue: 'e' })
  })

  it('has 3 beat capacity (6 * 0.5)', () => {
    expect(measure.beatsRemaining).toBe(3)
  })

  it('6 eighth notes fills it', () => {
    for (let i = 0; i < 6; i++) {
      measure.addNote(makeNote({ duration: 'e' }))
    }
    expect(measure.isFull).toBe(true)
  })
})
