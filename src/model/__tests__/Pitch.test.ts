import { describe, it, expect } from 'vitest'
import {
  PITCH_SEMITONES,
  ACCIDENTAL_OFFSET,
  pitchToMidi,
  midiToFrequency,
  isValidPitch,
  parsePitch,
} from '../Pitch.js'

describe('PITCH_SEMITONES', () => {
  it('C = 0', () => expect(PITCH_SEMITONES['C']).toBe(0))
  it('D = 2', () => expect(PITCH_SEMITONES['D']).toBe(2))
  it('E = 4', () => expect(PITCH_SEMITONES['E']).toBe(4))
  it('F = 5', () => expect(PITCH_SEMITONES['F']).toBe(5))
  it('G = 7', () => expect(PITCH_SEMITONES['G']).toBe(7))
  it('A = 9', () => expect(PITCH_SEMITONES['A']).toBe(9))
  it('B = 11', () => expect(PITCH_SEMITONES['B']).toBe(11))
})

describe('ACCIDENTAL_OFFSET', () => {
  it('# = +1', () => expect(ACCIDENTAL_OFFSET['#']).toBe(1))
  it('b = -1', () => expect(ACCIDENTAL_OFFSET['b']).toBe(-1))
  it('bb = -2', () => expect(ACCIDENTAL_OFFSET['bb']).toBe(-2))
  it('## = +2', () => expect(ACCIDENTAL_OFFSET['##']).toBe(2))
})

describe('pitchToMidi', () => {
  it('C4 = MIDI 60', () => {
    expect(pitchToMidi('C', null, 4)).toBe(60)
  })
  it('A4 = MIDI 69', () => {
    expect(pitchToMidi('A', null, 4)).toBe(69)
  })
  it('C#4 = MIDI 61', () => {
    expect(pitchToMidi('C', '#', 4)).toBe(61)
  })
  it('Db4 = MIDI 61', () => {
    expect(pitchToMidi('D', 'b', 4)).toBe(61)
  })
  it('Bb3 = MIDI 58', () => {
    expect(pitchToMidi('B', 'b', 3)).toBe(58)
  })
  it('F#5 = MIDI 78', () => {
    expect(pitchToMidi('F', '#', 5)).toBe(78)
  })
  it('C0 = MIDI 12', () => {
    expect(pitchToMidi('C', null, 0)).toBe(12)
  })
  it('B8 = MIDI 119', () => {
    expect(pitchToMidi('B', null, 8)).toBe(119)
  })
  it('C##4 = MIDI 62', () => {
    expect(pitchToMidi('C', '##', 4)).toBe(62)
  })
  it('Dbb4 = MIDI 60', () => {
    expect(pitchToMidi('D', 'bb', 4)).toBe(60)
  })
})

describe('midiToFrequency', () => {
  it('A4 (MIDI 69) = 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440)
  })
  it('A3 (MIDI 57) = 220 Hz', () => {
    expect(midiToFrequency(57)).toBeCloseTo(220, 5)
  })
  it('A5 (MIDI 81) = 880 Hz', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 5)
  })
  it('C4 (MIDI 60) ≈ 261.63 Hz', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)
  })
  it('middle MIDI values produce reasonable frequencies', () => {
    const freq = midiToFrequency(69)
    expect(freq).toBeGreaterThan(0)
  })
})

describe('isValidPitch', () => {
  const valid = ['C4', 'D5', 'E3', 'F#5', 'Bb3', 'C##4', 'Dbb2', 'G7', 'A0', 'B8']
  const invalid = ['c4', 'H4', 'C9', 'C', '4C', 'C4x', '', 'CC4', 'C-1', 'C#b4']

  valid.forEach((s) => {
    it(`"${s}" is valid`, () => expect(isValidPitch(s)).toBe(true))
  })

  invalid.forEach((s) => {
    it(`"${s}" is invalid`, () => expect(isValidPitch(s)).toBe(false))
  })
})

describe('parsePitch', () => {
  it('parses C4', () => {
    expect(parsePitch('C4')).toEqual({ pitch: 'C', accidental: null, octave: 4 })
  })
  it('parses F#5', () => {
    expect(parsePitch('F#5')).toEqual({ pitch: 'F', accidental: '#', octave: 5 })
  })
  it('parses Bb3', () => {
    expect(parsePitch('Bb3')).toEqual({ pitch: 'B', accidental: 'b', octave: 3 })
  })
  it('parses C##4', () => {
    expect(parsePitch('C##4')).toEqual({ pitch: 'C', accidental: '##', octave: 4 })
  })
  it('parses Dbb2', () => {
    expect(parsePitch('Dbb2')).toEqual({ pitch: 'D', accidental: 'bb', octave: 2 })
  })
  it('throws on invalid pitch string "H4"', () => {
    expect(() => parsePitch('H4')).toThrow()
  })
  it('throws on empty string', () => {
    expect(() => parsePitch('')).toThrow()
  })
  it('throws on "c4" (lowercase)', () => {
    expect(() => parsePitch('c4')).toThrow()
  })
})
