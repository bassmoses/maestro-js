import { describe, it, expect } from 'vitest'
import { DURATION_BEATS, durationToBeats, beatsToSeconds, parseDuration } from '../Duration.js'
import { DurationName } from '../types.js'

describe('DURATION_BEATS', () => {
  it('whole note = 4 beats', () => {
    expect(DURATION_BEATS['w']).toBe(4)
  })
  it('half note = 2 beats', () => {
    expect(DURATION_BEATS['h']).toBe(2)
  })
  it('quarter note = 1 beat', () => {
    expect(DURATION_BEATS['q']).toBe(1)
  })
  it('eighth note = 0.5 beats', () => {
    expect(DURATION_BEATS['e']).toBe(0.5)
  })
  it('sixteenth note = 0.25 beats', () => {
    expect(DURATION_BEATS['s']).toBe(0.25)
  })
  it('thirty-second note = 0.125 beats', () => {
    expect(DURATION_BEATS['t']).toBe(0.125)
  })
})

describe('durationToBeats', () => {
  it('whole note not dotted = 4', () => {
    expect(durationToBeats('w', false)).toBe(4)
  })
  it('half note not dotted = 2', () => {
    expect(durationToBeats('h', false)).toBe(2)
  })
  it('quarter note not dotted = 1', () => {
    expect(durationToBeats('q', false)).toBe(1)
  })
  it('eighth note not dotted = 0.5', () => {
    expect(durationToBeats('e', false)).toBe(0.5)
  })
  it('sixteenth note not dotted = 0.25', () => {
    expect(durationToBeats('s', false)).toBe(0.25)
  })
  it('thirty-second note not dotted = 0.125', () => {
    expect(durationToBeats('t', false)).toBe(0.125)
  })

  it('dotted whole = 6', () => {
    expect(durationToBeats('w', true)).toBe(6)
  })
  it('dotted half = 3', () => {
    expect(durationToBeats('h', true)).toBe(3)
  })
  it('dotted quarter = 1.5', () => {
    expect(durationToBeats('q', true)).toBe(1.5)
  })
  it('dotted eighth = 0.75', () => {
    expect(durationToBeats('e', true)).toBe(0.75)
  })
  it('dotted sixteenth = 0.375', () => {
    expect(durationToBeats('s', true)).toBe(0.375)
  })
  it('dotted thirty-second = 0.1875', () => {
    expect(durationToBeats('t', true)).toBe(0.1875)
  })
})

describe('beatsToSeconds', () => {
  it('1 beat at 60 bpm = 1 second', () => {
    expect(beatsToSeconds(1, 60)).toBe(1)
  })
  it('1 beat at 120 bpm = 0.5 seconds', () => {
    expect(beatsToSeconds(1, 120)).toBe(0.5)
  })
  it('4 beats at 60 bpm = 4 seconds', () => {
    expect(beatsToSeconds(4, 60)).toBe(4)
  })
  it('4 beats at 120 bpm = 2 seconds', () => {
    expect(beatsToSeconds(4, 120)).toBe(2)
  })
  it('2 beats at 90 bpm', () => {
    expect(beatsToSeconds(2, 90)).toBeCloseTo(1.333, 3)
  })
  it('0.5 beats at 60 bpm = 0.5 seconds', () => {
    expect(beatsToSeconds(0.5, 60)).toBe(0.5)
  })
})

describe('parseDuration', () => {
  const cases: [string, DurationName, boolean][] = [
    ['w', 'w', false],
    ['h', 'h', false],
    ['q', 'q', false],
    ['e', 'e', false],
    ['s', 's', false],
    ['t', 't', false],
    ['w.', 'w', true],
    ['h.', 'h', true],
    ['q.', 'q', true],
    ['e.', 'e', true],
    ['s.', 's', true],
    ['t.', 't', true],
  ]

  cases.forEach(([input, expectedDur, expectedDotted]) => {
    it(`parseDuration('${input}') => { duration: '${expectedDur}', dotted: ${expectedDotted} }`, () => {
      expect(parseDuration(input)).toEqual({ duration: expectedDur, dotted: expectedDotted })
    })
  })

  it('throws on invalid string "x"', () => {
    expect(() => parseDuration('x')).toThrow()
  })
  it('throws on invalid string "q.."', () => {
    expect(() => parseDuration('q..')).toThrow()
  })
  it('throws on empty string', () => {
    expect(() => parseDuration('')).toThrow()
  })
  it('throws on invalid string "Q"', () => {
    expect(() => parseDuration('Q')).toThrow()
  })
})
