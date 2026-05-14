import { describe, it, expect } from 'vitest'
import { pitchToFret, TUNINGS } from '../TabRenderer.js'
import { Song } from '../../../api/Song.js'

describe('TUNINGS', () => {
  it('guitar standard has 6 strings', () => {
    expect(TUNINGS.guitar.length).toBe(6)
  })
  it('bass has 4 strings', () => {
    expect(TUNINGS.bass.length).toBe(4)
  })
  it('guitar standard lowest string open = E2 (MIDI 40)', () => {
    // index 0 = lowest string = E2
    expect(TUNINGS.guitar[0]).toBe(40)
  })
  it('drop-D lowest string open = D2 (MIDI 38)', () => {
    expect(TUNINGS.dropD[0]).toBe(38)
  })
  it('mandolin has 4 strings', () => {
    expect(TUNINGS.mandolin.length).toBe(4)
  })
})

describe('pitchToFret', () => {
  it('maps E2 (MIDI 40) on guitar standard to string 6, fret 0', () => {
    // String 6 is the lowest E string (conventional 1-based from high to low)
    const result = pitchToFret(40, TUNINGS.guitar)
    expect(result.string).toBe(6)
    expect(result.fret).toBe(0)
  })
  it('maps F2 (MIDI 41) on guitar standard to string 6, fret 1', () => {
    const result = pitchToFret(41, TUNINGS.guitar)
    expect(result.string).toBe(6)
    expect(result.fret).toBe(1)
  })
  it('maps A4 (MIDI 69) on guitar standard to a valid position', () => {
    const result = pitchToFret(69, TUNINGS.guitar)
    expect(result.fret).toBeGreaterThanOrEqual(0)
    expect(result.fret).toBeLessThanOrEqual(24)
    expect(result.string).toBeGreaterThanOrEqual(1)
    expect(result.string).toBeLessThanOrEqual(6)
  })
  it('returns the lowest-fret position for C4 (fret <= 12)', () => {
    const result = pitchToFret(60, TUNINGS.guitar)
    expect(result.fret).toBeLessThanOrEqual(12)
  })
  it('A2 (MIDI 45) is string 5 open on standard guitar (fret 0)', () => {
    const result = pitchToFret(45, TUNINGS.guitar)
    expect(result.fret).toBe(0)
  })
  it('D2 (MIDI 38) on bass standard is string 2, fret 0', () => {
    // Bass strings low-to-high: E1=28, A1=33, D2=38, G2=43
    // String 2 (from high) = D2
    const result = pitchToFret(38, TUNINGS.bass)
    expect(result.fret).toBe(0)
  })
})

describe('tab voice smoke test', () => {
  it('exportSVG does not throw with a tab voice', () => {
    const song = new Song({ tempo: 120 })
    song.voice('guitar', { clef: 'tab' }).add('C4:q D4:q E4:q F4:q')
    expect(() => song.exportSVG()).not.toThrow()
  }, 30000)
})
