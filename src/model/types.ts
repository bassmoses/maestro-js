export type PitchName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = '#' | 'b' | 'bb' | '##' | null
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type DurationName = 'w' | 'h' | 'q' | 'e' | 's' | 't'
export type Dynamic = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'cresc' | 'decresc'
export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato' | null

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
  lyric?: string // lyrics text attached to this note
  articulation?: Articulation // articulation marking
  expression?: string // expression text above note (e.g. 'soli', 'tutti')
}
