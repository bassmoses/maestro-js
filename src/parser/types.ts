import type {
  PitchName,
  Accidental,
  Octave,
  DurationName,
  Dynamic,
  Articulation,
} from '../model/types.js'

export type { PitchName, Accidental, Octave, DurationName, Dynamic, Articulation }

export type TokenType =
  | 'NOTE'
  | 'CHORD'
  | 'TRIPLET'
  | 'SLUR'
  | 'BARLINE'
  | 'TIE'
  | 'REPEAT_START'
  | 'REPEAT_END'
  | 'DA_CAPO'
  | 'REHEARSAL_MARK'
  | 'EXPRESSION_TEXT'

export interface Token {
  type: TokenType
  raw: string
  position: number
}

export interface NoteNode {
  type: 'note' | 'rest'
  pitch: PitchName | null // null for rests
  accidental: Accidental
  octave: Octave | null // null for rests
  duration: DurationName
  dotted: boolean
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  isBarline: boolean
  chord: boolean
  chordGroup?: number // which chord group this note belongs to
  triplet: boolean
  tripletGroup?: number
  fermata: boolean
  breath?: boolean // breath mark — brief pause before next note
  repeatStart?: boolean // |: marker
  repeatEnd?: boolean // :| marker
  daCapo?: boolean // D.C. marker
  rehearsalMark?: string // rehearsal mark attached to this barline/measure
  lyric?: string // lyrics text attached to this note
  articulation?: Articulation // articulation marking
  expression?: string // expression text attached to this note
}

export interface ValidationError {
  message: string
  measure?: number // 1-based measure number where error occurred
  severity?: 'error' | 'warning'
}
