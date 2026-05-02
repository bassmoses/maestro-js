import { describe, it, expect } from 'vitest'
import {
  groupNotesForRender,
  noteToVexKey,
  noteToVexDuration,
  DURATION_MAP,
  collectHairpinRuns,
} from '../VexFlowAdapter.js'
import type { HairpinRun, RenderNote } from '../VexFlowAdapter.js'
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

describe('VexFlowAdapter utilities', () => {
  describe('noteToVexKey', () => {
    it('converts a simple note', () => {
      expect(noteToVexKey(makeNote())).toBe('C/4')
    })

    it('converts note with sharp', () => {
      expect(noteToVexKey(makeNote({ pitch: 'F', accidental: '#', octave: 5 }))).toBe('F#/5')
    })

    it('converts note with flat', () => {
      expect(noteToVexKey(makeNote({ pitch: 'B', accidental: 'b', octave: 3 }))).toBe('Bb/3')
    })

    it('converts note with double sharp', () => {
      expect(noteToVexKey(makeNote({ accidental: '##' }))).toBe('C##/4')
    })

    it('converts note with double flat', () => {
      expect(noteToVexKey(makeNote({ accidental: 'bb' }))).toBe('Cbb/4')
    })

    it('rest returns B/4', () => {
      expect(noteToVexKey(makeNote({ pitch: 'R' }))).toBe('B/4')
    })
  })

  describe('noteToVexDuration', () => {
    it('converts whole note', () => {
      expect(noteToVexDuration(makeNote({ duration: 'w' }))).toBe('w')
    })

    it('converts half note', () => {
      expect(noteToVexDuration(makeNote({ duration: 'h' }))).toBe('h')
    })

    it('converts quarter note', () => {
      expect(noteToVexDuration(makeNote({ duration: 'q' }))).toBe('q')
    })

    it('converts eighth note', () => {
      expect(noteToVexDuration(makeNote({ duration: 'e' }))).toBe('8')
    })

    it('converts sixteenth note', () => {
      expect(noteToVexDuration(makeNote({ duration: 's' }))).toBe('16')
    })

    it('converts thirty-second note', () => {
      expect(noteToVexDuration(makeNote({ duration: 't' }))).toBe('32')
    })

    it('adds d for dotted', () => {
      expect(noteToVexDuration(makeNote({ duration: 'h', dotted: true }))).toBe('hd')
    })

    it('adds r for rest', () => {
      expect(noteToVexDuration(makeNote({ duration: 'q', pitch: 'R' }))).toBe('qr')
    })

    it('adds d and r for dotted rest', () => {
      expect(noteToVexDuration(makeNote({ duration: 'q', pitch: 'R', dotted: true }))).toBe('qdr')
    })
  })

  describe('DURATION_MAP', () => {
    it('has all 6 durations', () => {
      expect(Object.keys(DURATION_MAP)).toHaveLength(6)
    })
  })

  describe('groupNotesForRender', () => {
    it('groups single notes individually', () => {
      const notes = [makeNote(), makeNote({ pitch: 'D' })]
      const groups = groupNotesForRender(notes)
      expect(groups).toHaveLength(2)
      expect(groups[0].keys).toEqual(['C/4'])
      expect(groups[1].keys).toEqual(['D/4'])
    })

    it('groups chord notes into a single render note', () => {
      const notes = [
        makeNote({ chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'E', chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'G', chord: true, chordGroup: 0 }),
      ]
      const groups = groupNotesForRender(notes)
      expect(groups).toHaveLength(1)
      expect(groups[0].keys).toEqual(['C/4', 'E/4', 'G/4'])
    })

    it('separates different chord groups', () => {
      const notes = [
        makeNote({ chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'E', chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'D', chord: true, chordGroup: 1 }),
        makeNote({ pitch: 'F', chord: true, chordGroup: 1 }),
      ]
      const groups = groupNotesForRender(notes)
      expect(groups).toHaveLength(2)
      expect(groups[0].keys).toEqual(['C/4', 'E/4'])
      expect(groups[1].keys).toEqual(['D/4', 'F/4'])
    })

    it('interleaves single and chord notes', () => {
      const notes = [
        makeNote(),
        makeNote({ pitch: 'E', chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'G', chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'A' }),
      ]
      const groups = groupNotesForRender(notes)
      expect(groups).toHaveLength(3)
      expect(groups[0].keys).toEqual(['C/4'])
      expect(groups[1].keys).toEqual(['E/4', 'G/4'])
      expect(groups[2].keys).toEqual(['A/4'])
    })

    it('preserves dynamics from first chord note', () => {
      const notes = [
        makeNote({ chord: true, chordGroup: 0, dynamic: 'ff' }),
        makeNote({ pitch: 'E', chord: true, chordGroup: 0, dynamic: null }),
      ]
      const groups = groupNotesForRender(notes)
      expect(groups[0].dynamic).toBe('ff')
    })

    it('preserves tied flag', () => {
      const groups = groupNotesForRender([makeNote({ tied: true })])
      expect(groups[0].tied).toBe(true)
    })

    it('preserves slurred flag', () => {
      const groups = groupNotesForRender([makeNote({ slurred: true })])
      expect(groups[0].slurred).toBe(true)
    })

    it('preserves dotted flag', () => {
      const groups = groupNotesForRender([makeNote({ dotted: true })])
      expect(groups[0].dotted).toBe(true)
    })

    it('handles rest notes', () => {
      const groups = groupNotesForRender([makeNote({ pitch: 'R' })])
      expect(groups[0].isRest).toBe(true)
    })

    it('handles empty input', () => {
      expect(groupNotesForRender([])).toEqual([])
    })

    it('tracks accidentals per key in chord', () => {
      const notes = [
        makeNote({ pitch: 'F', accidental: '#', chord: true, chordGroup: 0 }),
        makeNote({ pitch: 'B', accidental: 'b', chord: true, chordGroup: 0 }),
      ]
      const groups = groupNotesForRender(notes)
      expect(groups[0].accidentals).toEqual(['#', 'b'])
    })
  })
})

// ─── collectHairpinRuns tests ────────────────────────────────────────────────

function makeRenderNote(dynamic: RenderNote['dynamic']): RenderNote {
  return {
    keys: ['C/4'],
    duration: 'q',
    accidentals: [null],
    dynamic,
    tied: false,
    slurred: false,
    dotted: false,
    isRest: false,
    fermata: false,
    articulation: undefined as unknown as RenderNote['articulation'],
    breath: false,
    ornament: null as unknown as RenderNote['ornament'],
    graceNote: false,
    chordSymbol: undefined,
    glissando: false,
    expression: undefined,
    sourceNotes: [],
  }
}

describe('collectHairpinRuns', () => {
  it('returns empty array for notes with no hairpin dynamics', () => {
    const notes = [makeRenderNote('f'), makeRenderNote('p'), makeRenderNote(null)]
    const runs: HairpinRun[] = collectHairpinRuns(notes)
    expect(runs).toHaveLength(0)
  })

  it('collects a single cresc run', () => {
    const notes = [
      makeRenderNote('f'),
      makeRenderNote('cresc'),
      makeRenderNote('cresc'),
      makeRenderNote('cresc'),
      makeRenderNote('p'),
    ]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ startIdx: 1, endIdx: 3, type: 'cresc' })
  })

  it('collects a single decresc run', () => {
    const notes = [
      makeRenderNote('f'),
      makeRenderNote('decresc'),
      makeRenderNote('decresc'),
      makeRenderNote('p'),
    ]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ startIdx: 1, endIdx: 2, type: 'decresc' })
  })

  it('closes a cresc run when a decresc starts', () => {
    const notes = [
      makeRenderNote('cresc'),
      makeRenderNote('cresc'),
      makeRenderNote('decresc'),
      makeRenderNote('decresc'),
    ]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ startIdx: 0, endIdx: 1, type: 'cresc' })
    expect(runs[1]).toEqual({ startIdx: 2, endIdx: 3, type: 'decresc' })
  })

  it('closes a run at end of array when no non-hairpin note follows', () => {
    const notes = [makeRenderNote('p'), makeRenderNote('cresc'), makeRenderNote('cresc')]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ startIdx: 1, endIdx: 2, type: 'cresc' })
  })

  it('handles a single hairpin note', () => {
    const notes = [makeRenderNote('cresc')]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ startIdx: 0, endIdx: 0, type: 'cresc' })
  })

  it('returns empty array for empty input', () => {
    expect(collectHairpinRuns([])).toHaveLength(0)
  })

  it('handles multiple separate runs', () => {
    const notes = [
      makeRenderNote('cresc'),
      makeRenderNote('f'),
      makeRenderNote('decresc'),
      makeRenderNote('p'),
      makeRenderNote('cresc'),
    ]
    const runs = collectHairpinRuns(notes)
    expect(runs).toHaveLength(3)
    expect(runs[0]).toEqual({ startIdx: 0, endIdx: 0, type: 'cresc' })
    expect(runs[1]).toEqual({ startIdx: 2, endIdx: 2, type: 'decresc' })
    expect(runs[2]).toEqual({ startIdx: 4, endIdx: 4, type: 'cresc' })
  })
})
