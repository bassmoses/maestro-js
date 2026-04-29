import { describe, it, expect } from 'vitest'
import { findBeamGroups } from '../BeamGrouper.js'
import { Note } from '../../../model/Note.js'
import type { NoteData } from '../../../model/types.js'

function makeNote(overrides: Partial<NoteData> = {}): Note {
  return new Note({
    pitch: 'C',
    accidental: null,
    octave: 4,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    chord: false,
    ...overrides,
  })
}

describe('BeamGrouper', () => {
  describe('findBeamGroups', () => {
    it('returns empty array for all quarter notes', () => {
      const notes = [makeNote(), makeNote(), makeNote(), makeNote()]
      expect(findBeamGroups(notes, 4)).toEqual([])
    })

    it('groups consecutive eighth notes', () => {
      const notes = [
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e' }),
      ]
      const groups = findBeamGroups(notes, 4)
      expect(groups.length).toBeGreaterThanOrEqual(1)
      expect(groups[0].startIndex).toBe(0)
    })

    it('groups consecutive sixteenth notes', () => {
      const notes = [
        makeNote({ duration: 's' }),
        makeNote({ duration: 's' }),
        makeNote({ duration: 's' }),
        makeNote({ duration: 's' }),
      ]
      const groups = findBeamGroups(notes, 4)
      expect(groups.length).toBeGreaterThanOrEqual(1)
    })

    it('does not beam single eighth note', () => {
      const notes = [
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'q' }),
        makeNote({ duration: 'q' }),
      ]
      const groups = findBeamGroups(notes, 4)
      expect(groups).toEqual([])
    })

    it('rest breaks beam group', () => {
      const notes = [
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e', pitch: 'R' }),
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e' }),
      ]
      const groups = findBeamGroups(notes, 4)
      // First group is just 1 note (not beamable), second group is 2 notes
      expect(groups.some((g) => g.endIndex - g.startIndex >= 1)).toBe(true)
    })

    it('handles mixed durations correctly', () => {
      const notes = [
        makeNote({ duration: 'q' }),
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'e' }),
        makeNote({ duration: 'q' }),
      ]
      const groups = findBeamGroups(notes, 4)
      expect(groups.length).toBe(1)
      expect(groups[0]).toEqual({ startIndex: 1, endIndex: 2 })
    })

    it('handles thirty-second notes', () => {
      const notes = [makeNote({ duration: 't' }), makeNote({ duration: 't' })]
      const groups = findBeamGroups(notes, 4)
      expect(groups.length).toBe(1)
    })

    it('empty notes returns empty groups', () => {
      expect(findBeamGroups([], 4)).toEqual([])
    })
  })
})
