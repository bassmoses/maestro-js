import { describe, it, expect } from 'vitest'
import { GM_DRUM_MAP, PERCUSSION_INSTRUMENTS } from '../percussion.js'
import { Note } from '../Note.js'
import type { NoteData } from '../types.js'

describe('GM_DRUM_MAP', () => {
  it('maps KICK to MIDI 36', () => {
    expect(GM_DRUM_MAP['KICK']).toBe(36)
  })
  it('maps SNARE to MIDI 38', () => {
    expect(GM_DRUM_MAP['SNARE']).toBe(38)
  })
  it('maps HIHAT to MIDI 42', () => {
    expect(GM_DRUM_MAP['HIHAT']).toBe(42)
  })
  it('maps HIHAT_OPEN to MIDI 46', () => {
    expect(GM_DRUM_MAP['HIHAT_OPEN']).toBe(46)
  })
  it('maps CRASH to MIDI 49', () => {
    expect(GM_DRUM_MAP['CRASH']).toBe(49)
  })
  it('maps RIDE to MIDI 51', () => {
    expect(GM_DRUM_MAP['RIDE']).toBe(51)
  })
  it('maps TOM_HIGH to MIDI 50', () => {
    expect(GM_DRUM_MAP['TOM_HIGH']).toBe(50)
  })
  it('maps TOM_MID to MIDI 47', () => {
    expect(GM_DRUM_MAP['TOM_MID']).toBe(47)
  })
  it('maps TOM_LOW to MIDI 45', () => {
    expect(GM_DRUM_MAP['TOM_LOW']).toBe(45)
  })
  it('PERCUSSION_INSTRUMENTS includes all keys', () => {
    expect(PERCUSSION_INSTRUMENTS).toContain('KICK')
    expect(PERCUSSION_INSTRUMENTS).toContain('SNARE')
    expect(PERCUSSION_INSTRUMENTS).toContain('HIHAT')
  })
})

describe('Note with percussion field', () => {
  it('isPercussion is true when percussion is set', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
      percussion: 'SNARE',
    }
    const note = new Note(data)
    expect(note.isPercussion).toBe(true)
  })
  it('isPercussion is false for ordinary notes', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
    }
    const note = new Note(data)
    expect(note.isPercussion).toBe(false)
  })
  it('percussionMidi returns correct MIDI number for KICK', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
      percussion: 'KICK',
    }
    const note = new Note(data)
    expect(note.percussionMidi).toBe(36)
  })
  it('percussionMidi returns null for non-percussion note', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
    }
    const note = new Note(data)
    expect(note.percussionMidi).toBeNull()
  })
})

import { nodeToNote } from '../converter.js'
import type { NoteNode } from '../../parser/types.js'

describe('nodeToNote — percussion passthrough', () => {
  it('copies percussion field to Note', () => {
    const node: NoteNode = {
      type: 'note',
      pitch: null,
      accidental: null,
      octave: null,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: false,
      triplet: false,
      fermata: false,
      percussion: 'SNARE',
    }
    const note = nodeToNote(node)
    expect(note.isPercussion).toBe(true)
    expect(note.percussion).toBe('SNARE')
    expect(note.percussionMidi).toBe(38)
  })
})

import { noteToVexKey, noteToVexDuration } from '../../adapters/renderer/render-note.js'

describe('noteToVexKey — percussion', () => {
  it('returns b/4 for a percussion note', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
      percussion: 'SNARE',
    }
    const note = new Note(data)
    expect(noteToVexKey(note)).toBe('b/4')
  })
  it('noteToVexDuration is unchanged for percussion (not a rest)', () => {
    const data: NoteData = {
      pitch: 'C',
      accidental: null,
      octave: 4,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      chord: false,
      fermata: false,
      triplet: false,
      percussion: 'KICK',
    }
    const note = new Note(data)
    expect(noteToVexDuration(note)).toBe('q')
  })
})
