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

/**
 * Parse a pitch string into its components.
 * Throws on invalid input.
 */
export function parsePitch(str: string): { pitch: PitchName; accidental: Accidental; octave: Octave } {
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
