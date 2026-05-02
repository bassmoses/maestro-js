import { PitchName, Accidental, Octave } from './types.js'

export const PITCH_SEMITONES: Record<PitchName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export const ACCIDENTAL_OFFSET: Record<NonNullable<Accidental>, number> = {
  '#': 1,
  b: -1,
  bb: -2,
  '##': 2,
}

/**
 * Convert a pitch to its MIDI number.
 * Standard MIDI: C4 = 60, A4 = 69.
 */
export function pitchToMidi(pitch: PitchName, accidental: Accidental, octave: Octave): number {
  const semitone = PITCH_SEMITONES[pitch]
  const offset = accidental !== null ? ACCIDENTAL_OFFSET[accidental] : 0
  // MIDI formula: (octave + 1) * 12 + semitone
  return (octave + 1) * 12 + semitone + offset
}

/**
 * Convert a MIDI number to frequency in Hz.
 * A4 (MIDI 69) = 440 Hz.
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Matches pitch strings like C4, F#5, Bb3, C##4, Dbb2
const PITCH_REGEX = /^([A-G])(##|bb|#|b)?([0-8])$/

/**
 * Returns true if the string is a valid pitch notation.
 */
export function isValidPitch(str: string): boolean {
  return PITCH_REGEX.test(str)
}

// Reverse lookup: semitone offset (0-11) to natural pitch name + accidental
// Uses sharps by default; midiToPitch accepts a preferFlats option
const SEMITONE_TO_PITCH_SHARP: Array<{ pitch: PitchName; accidental: Accidental }> = [
  { pitch: 'C', accidental: null }, // 0
  { pitch: 'C', accidental: '#' }, // 1
  { pitch: 'D', accidental: null }, // 2
  { pitch: 'D', accidental: '#' }, // 3
  { pitch: 'E', accidental: null }, // 4
  { pitch: 'F', accidental: null }, // 5
  { pitch: 'F', accidental: '#' }, // 6
  { pitch: 'G', accidental: null }, // 7
  { pitch: 'G', accidental: '#' }, // 8
  { pitch: 'A', accidental: null }, // 9
  { pitch: 'A', accidental: '#' }, // 10
  { pitch: 'B', accidental: null }, // 11
]

const SEMITONE_TO_PITCH_FLAT: Array<{ pitch: PitchName; accidental: Accidental }> = [
  { pitch: 'C', accidental: null }, // 0
  { pitch: 'D', accidental: 'b' }, // 1
  { pitch: 'D', accidental: null }, // 2
  { pitch: 'E', accidental: 'b' }, // 3
  { pitch: 'E', accidental: null }, // 4
  { pitch: 'F', accidental: null }, // 5
  { pitch: 'G', accidental: 'b' }, // 6
  { pitch: 'G', accidental: null }, // 7
  { pitch: 'A', accidental: 'b' }, // 8
  { pitch: 'A', accidental: null }, // 9
  { pitch: 'B', accidental: 'b' }, // 10
  { pitch: 'B', accidental: null }, // 11
]

/**
 * Convert a MIDI number back to pitch components.
 * Uses sharps by default, or flats if preferFlats is true.
 */
export function midiToPitch(
  midi: number,
  preferFlats = false
): {
  pitch: PitchName
  accidental: Accidental
  octave: Octave
} {
  if (midi < 0 || midi > 127) {
    throw new Error(`MIDI number out of range: ${midi}`)
  }
  const rawOctave = Math.floor(midi / 12) - 1
  if (rawOctave > 8) {
    throw new Error(
      `MIDI ${midi} produces octave ${rawOctave}, which is above the supported 0–8 range.`
    )
  }
  const octave = Math.max(0, rawOctave)
  const semitone = midi % 12
  const table = preferFlats ? SEMITONE_TO_PITCH_FLAT : SEMITONE_TO_PITCH_SHARP
  const { pitch, accidental } = table[semitone]
  return { pitch, accidental, octave: octave as Octave }
}

/**
 * Parse a pitch string into its components.
 * Throws on invalid input.
 */
export function parsePitch(str: string): {
  pitch: PitchName
  accidental: Accidental
  octave: Octave
} {
  const match = str.match(PITCH_REGEX)
  if (!match) {
    throw new Error(`Invalid pitch string: "${str}"`)
  }

  const pitch = match[1] as PitchName
  const accidentalStr = match[2] as NonNullable<Accidental> | undefined
  const accidental: Accidental = accidentalStr ?? null
  const octave = parseInt(match[3], 10) as Octave

  return { pitch, accidental, octave }
}
