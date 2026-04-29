import { describe, it, expect } from 'vitest'
import { midiToPitch, pitchToMidi } from '../Pitch.js'

describe('midiToPitch()', () => {
  it('converts MIDI 60 to C4', () => {
    const result = midiToPitch(60)
    expect(result.pitch).toBe('C')
    expect(result.accidental).toBeNull()
    expect(result.octave).toBe(4)
  })

  it('converts MIDI 69 to A4', () => {
    const result = midiToPitch(69)
    expect(result.pitch).toBe('A')
    expect(result.accidental).toBeNull()
    expect(result.octave).toBe(4)
  })

  it('converts MIDI 61 to C#4', () => {
    const result = midiToPitch(61)
    expect(result.pitch).toBe('C')
    expect(result.accidental).toBe('#')
    expect(result.octave).toBe(4)
  })

  it('converts MIDI 72 to C5', () => {
    const result = midiToPitch(72)
    expect(result.pitch).toBe('C')
    expect(result.accidental).toBeNull()
    expect(result.octave).toBe(5)
  })

  it('converts MIDI 0 to C0', () => {
    const result = midiToPitch(0)
    expect(result.pitch).toBe('C')
    expect(result.octave).toBe(0)
  })

  it('round-trips all natural notes', () => {
    const notes = [
      { pitch: 'C' as const, octave: 4 },
      { pitch: 'D' as const, octave: 4 },
      { pitch: 'E' as const, octave: 4 },
      { pitch: 'F' as const, octave: 4 },
      { pitch: 'G' as const, octave: 4 },
      { pitch: 'A' as const, octave: 4 },
      { pitch: 'B' as const, octave: 4 },
    ]
    for (const { pitch, octave } of notes) {
      const midi = pitchToMidi(pitch, null, octave as 4)
      const result = midiToPitch(midi)
      expect(result.pitch).toBe(pitch)
      expect(result.accidental).toBeNull()
      expect(result.octave).toBe(octave)
    }
  })

  it('throws for MIDI values out of range', () => {
    expect(() => midiToPitch(-1)).toThrow()
    expect(() => midiToPitch(128)).toThrow()
  })
})
