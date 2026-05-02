import type {
  PitchName,
  Accidental,
  Octave,
  DurationName,
  Dynamic,
  Articulation,
  Ornament,
} from '../model/types.js'

export type { PitchName, Accidental, Octave, DurationName, Dynamic, Articulation, Ornament }

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
  | 'DAL_SEGNO'
  | 'SEGNO'
  | 'CODA'
  | 'FINE'
  | 'VOLTA'
  | 'GRACE_NOTE'
  | 'CHORD_SYMBOL'
  | 'GLISSANDO'

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
  tupletRatio?: { num: number; den: number } // general tuplet ratio
  fermata: boolean
  breath?: boolean // breath mark — brief pause before next note
  repeatStart?: boolean // |: marker
  repeatEnd?: boolean // :| marker
  daCapo?: boolean // D.C. marker
  dalSegno?: boolean // D.S. marker
  segno?: boolean // Segno marker
  coda?: boolean // Coda marker
  fine?: boolean // Fine marker
  volta?: number // Volta ending number (1, 2, etc.)
  rehearsalMark?: string // rehearsal mark attached to this barline/measure
  lyric?: string // lyrics text attached to this note
  articulation?: Articulation // articulation marking
  ornament?: Ornament // ornament marking
  graceNote?: boolean // this is a grace note
  chordSymbol?: string // chord symbol annotation e.g. "Cmaj7"
  glissando?: boolean // slide to next note
  expression?: string // expression text attached to this note
}

export interface ValidationError {
  message: string
  measure?: number // 1-based measure number where error occurred
  severity?: 'error' | 'warning'
}
