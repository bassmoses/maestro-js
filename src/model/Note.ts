import {
  NoteData,
  PitchName,
  Accidental,
  Octave,
  DurationName,
  Dynamic,
  Articulation,
} from './types.js'
import { durationToBeats } from './Duration.js'
import { pitchToMidi, midiToFrequency } from './Pitch.js'

export class Note implements NoteData {
  readonly pitch: PitchName | 'R'
  readonly accidental: Accidental
  readonly octave: Octave
  readonly duration: DurationName
  readonly dotted: boolean
  readonly dynamic: Dynamic | null
  readonly tied: boolean
  readonly slurred: boolean
  readonly chord: boolean
  readonly chordGroup?: number
  readonly fermata: boolean
  readonly triplet: boolean
  readonly lyric?: string
  readonly articulation: Articulation

  constructor(data: NoteData) {
    this.pitch = data.pitch
    this.accidental = data.accidental
    this.octave = data.octave
    this.duration = data.duration
    this.dotted = data.dotted
    this.dynamic = data.dynamic
    this.tied = data.tied
    this.slurred = data.slurred
    this.chord = data.chord
    this.chordGroup = data.chordGroup
    this.fermata = data.fermata ?? false
    this.triplet = data.triplet ?? false
    this.lyric = data.lyric
    this.articulation = data.articulation ?? null
  }

  get beats(): number {
    return durationToBeats(this.duration, this.dotted)
  }

  get isRest(): boolean {
    return this.pitch === 'R'
  }

  get midi(): number | null {
    if (this.pitch === 'R') return null
    return pitchToMidi(this.pitch, this.accidental, this.octave)
  }

  get frequency(): number | null {
    const m = this.midi
    if (m === null) return null
    return midiToFrequency(m)
  }
}
