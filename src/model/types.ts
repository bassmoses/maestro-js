export type PitchName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = '#' | 'b' | 'bb' | '##' | null
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type DurationName = 'w' | 'h' | 'q' | 'e' | 's' | 't'
export type Dynamic = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'cresc' | 'decresc'
export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato' | null
export type Ornament = 'trill' | 'mordent' | 'turn' | null

/** Floating-point comparison tolerance for beat arithmetic. */
export const BEAT_EPSILON = 1e-9

export interface NoteData {
  pitch: PitchName | 'R' // R = rest
  accidental: Accidental
  octave: Octave
  duration: DurationName
  dotted: boolean
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  chord: boolean // part of a chord group
  chordGroup?: number // distinguishes separate chord groups
  fermata?: boolean // fermata hold
  breath?: boolean // breath mark — brief pause before next note
  triplet?: boolean // part of a triplet group
  tupletRatio?: { num: number; den: number } // general tuplet ratio (e.g. {num:5,den:4} for quintuplet)
  lyric?: string // lyrics text attached to this note
  articulation?: Articulation // articulation marking
  ornament?: Ornament // ornament marking (trill, mordent, turn)
  graceNote?: boolean // this is a grace note (steals time from main note)
  chordSymbol?: string // chord symbol annotation e.g. "Cmaj7"
  glissando?: boolean // slide to next note
  expression?: string // expression text above note (e.g. 'soli', 'tutti')
}
