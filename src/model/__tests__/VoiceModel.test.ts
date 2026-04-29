import { describe, it, expect, beforeEach } from 'vitest'
import { VoiceModel } from '../Voice.js'
import { Note } from '../Note.js'
import { NoteData } from '../types.js'
import { TimeSignature } from '../Measure.js'

const TS_4_4: TimeSignature = { beats: 4, noteValue: 'q' }

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

describe('VoiceModel', () => {
  let voice: VoiceModel

  beforeEach(() => {
    voice = new VoiceModel('soprano', 'treble')
  })

  it('has correct name and clef', () => {
    expect(voice.name).toBe('soprano')
    expect(voice.clef).toBe('treble')
  })

  it('starts with no measures', () => {
    expect(voice.getMeasures()).toHaveLength(0)
  })

  it('starts with no notes', () => {
    expect(voice.getAllNotes()).toHaveLength(0)
  })

  it('addNote auto-creates the first measure', () => {
    voice.addNote(makeNote(), TS_4_4)
    expect(voice.getMeasures()).toHaveLength(1)
  })

  it('first measure contains the added note', () => {
    const note = makeNote()
    voice.addNote(note, TS_4_4)
    expect(voice.getMeasures()[0].getNotes()).toContain(note)
  })

  it('fills first measure before creating a second', () => {
    for (let i = 0; i < 4; i++) {
      voice.addNote(makeNote({ duration: 'q' }), TS_4_4)
    }
    expect(voice.getMeasures()).toHaveLength(1)
  })

  it('creates new measure when current is full', () => {
    // Fill 4/4 measure (4 quarter notes)
    for (let i = 0; i < 4; i++) {
      voice.addNote(makeNote({ duration: 'q' }), TS_4_4)
    }
    // 5th note goes to second measure
    voice.addNote(makeNote({ duration: 'q' }), TS_4_4)
    expect(voice.getMeasures()).toHaveLength(2)
  })

  it('getAllNotes returns all notes in order', () => {
    const notes: Note[] = []
    for (let i = 0; i < 6; i++) {
      const n = makeNote({ duration: 'q' })
      notes.push(n)
      voice.addNote(n, TS_4_4)
    }
    const all = voice.getAllNotes()
    expect(all).toHaveLength(6)
    notes.forEach((n, i) => expect(all[i]).toBe(n))
  })

  it('getMeasures returns readonly array', () => {
    voice.addNote(makeNote(), TS_4_4)
    const measures = voice.getMeasures()
    expect(measures).toHaveLength(1)
  })

  it('supports bass clef', () => {
    const bass = new VoiceModel('bass', 'bass')
    expect(bass.clef).toBe('bass')
  })

  it('supports all clef types', () => {
    const clefs = ['treble', 'bass', 'treble-8', 'alto', 'tenor'] as const
    clefs.forEach((clef) => {
      const v = new VoiceModel('test', clef)
      expect(v.clef).toBe(clef)
    })
  })
})
