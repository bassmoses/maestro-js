import type { Note } from '../../model/Note.js'
import type {
  Dynamic,
  Articulation as ArticulationType,
  Ornament as OrnamentType,
} from '../../model/types.js'
import { DURATION_MAP, ACCIDENTAL_MAP } from './vex-maps.js'

export interface RenderNote {
  keys: string[]
  duration: string
  accidentals: (string | null)[]
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  dotted: boolean
  isRest: boolean
  chordGroup?: number
  fermata: boolean
  breath: boolean
  lyric?: string
  articulation: ArticulationType
  ornament: OrnamentType
  graceNote: boolean
  chordSymbol?: string
  glissando: boolean
  expression?: string
  tupletRatio?: { num: number; den: number }
  sourceNotes: Note[]
}

export function noteToVexKey(note: Note): string {
  if (note.isRest) return 'B/4'
  if (note.isPercussion) return 'b/4'
  const acc = note.accidental ?? ''
  return `${note.pitch}${acc}/${note.octave}`
}

export function noteToVexDuration(note: Note): string {
  let dur = DURATION_MAP[note.duration]
  if (note.dotted) dur += 'd'
  if (note.isRest) dur += 'r'
  return dur
}

export function noteToRenderNote(note: Note, isRest = note.isRest): RenderNote {
  return {
    keys: [noteToVexKey(note)],
    duration: noteToVexDuration(note),
    accidentals: [note.accidental ? (ACCIDENTAL_MAP[note.accidental] ?? null) : null],
    dynamic: note.dynamic,
    tied: note.tied,
    slurred: note.slurred,
    dotted: note.dotted,
    isRest,
    chordGroup: note.chordGroup,
    fermata: note.fermata,
    breath: note.breath,
    lyric: note.lyric,
    articulation: note.articulation,
    ornament: note.ornament,
    graceNote: note.graceNote,
    chordSymbol: note.chordSymbol,
    glissando: note.glissando,
    expression: note.expression,
    tupletRatio: note.tupletRatio,
    sourceNotes: [note],
  }
}

export function groupNotesForRender(notes: readonly Note[]): RenderNote[] {
  const result: RenderNote[] = []
  let currentChordGroup: number | undefined
  let currentChord: RenderNote | null = null

  for (const note of notes) {
    if (note.chord && note.chordGroup != null) {
      if (note.chordGroup === currentChordGroup && currentChord) {
        currentChord.keys.push(noteToVexKey(note))
        currentChord.accidentals.push(
          note.accidental ? (ACCIDENTAL_MAP[note.accidental] ?? null) : null
        )
        currentChord.sourceNotes.push(note)
      } else {
        if (currentChord) result.push(currentChord)
        currentChordGroup = note.chordGroup
        currentChord = noteToRenderNote(note, false)
      }
    } else {
      if (currentChord) {
        result.push(currentChord)
        currentChord = null
        currentChordGroup = undefined
      }
      result.push(noteToRenderNote(note))
    }
  }

  if (currentChord) result.push(currentChord)
  return result
}
