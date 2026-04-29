import type { PitchName, Accidental, Octave, DurationName, Dynamic } from '../model/types.js'

export type { PitchName, Accidental, Octave, DurationName, Dynamic }

export type TokenType =
  | 'NOTE'
  | 'CHORD'
  | 'TRIPLET'
  | 'SLUR'
  | 'BARLINE'
  | 'TIE'

export interface Token {
  type: TokenType
  raw: string
  position: number
}

export interface NoteNode {
  type: 'note' | 'rest'
  pitch: PitchName | null   // null for rests
  accidental: Accidental
  octave: Octave | null     // null for rests
  duration: DurationName
  dotted: boolean
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  isBarline: boolean
  chord: boolean
  triplet: boolean
  tripletGroup?: number
}

export interface ValidationError {
  message: string
}
