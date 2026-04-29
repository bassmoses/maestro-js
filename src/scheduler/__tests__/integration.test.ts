import { describe, it, expect } from 'vitest'
import { parse } from '../../parser/index.js'
import { buildScore } from '../../model/converter.js'
import { Scheduler } from '../Scheduler.js'

describe('Integration: parse → buildScore → Scheduler', () => {
  it('produces a 4-event timeline for 4 quarter notes', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline).toHaveLength(4)
  })

  it('last note ends at 2.0s (4 quarter notes at 120 BPM)', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    const last = timeline[timeline.length - 1]
    expect(last.time + last.note.duration).toBeCloseTo(2.0)
  })

  it('first event time is 0', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].time).toBe(0)
  })

  it('pipeline with multiple measures produces correct total duration', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline).toHaveLength(8)
    const last = timeline[timeline.length - 1]
    expect(last.time + last.note.duration).toBeCloseTo(4.0) // 8 quarters at 120 BPM
  })

  it('pipeline handles rests correctly', () => {
    const nodes = parse('R:q C4:q D4:q E4:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.pitch).toBeNull()
    expect(timeline[1].time).toBeCloseTo(0.5)
  })

  it('pipeline handles accidentals correctly', () => {
    const nodes = parse('F#4:q Bb3:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.pitch).toBe('F#4')
    expect(timeline[1].note.pitch).toBe('Bb3')
  })

  it('pipeline preserves dynamics as velocity', () => {
    const nodes = parse('C4:q(ff) D4:q(p)')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.velocity).toBe(112) // ff
    expect(timeline[1].note.velocity).toBe(48) // p
  })

  // Phase 2: Chord timing tests
  it('chord notes share the same time position', () => {
    const nodes = parse('[C4 E4 G4]:q D4:q')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    // 3 chord notes + 1 single note = 4 events
    expect(timeline).toHaveLength(4)
    // All chord notes at time 0
    expect(timeline[0].time).toBe(0)
    expect(timeline[1].time).toBe(0)
    expect(timeline[2].time).toBe(0)
    // D4 follows at 0.5s (one quarter at 120 BPM)
    expect(timeline[3].time).toBeCloseTo(0.5)
  })

  it('two chords occupy correct timing', () => {
    const nodes = parse('[C4 E4 G4]:h [D4 F4 A4]:h')
    const score = buildScore(nodes, { tempo: 120 })
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline).toHaveLength(6)
    // First chord at time 0
    expect(timeline[0].time).toBe(0)
    expect(timeline[1].time).toBe(0)
    expect(timeline[2].time).toBe(0)
    // Second chord at time 1.0s (half note at 120 BPM)
    expect(timeline[3].time).toBeCloseTo(1.0)
    expect(timeline[4].time).toBeCloseTo(1.0)
    expect(timeline[5].time).toBeCloseTo(1.0)
  })

  it('chord notes fit in a single measure', () => {
    const nodes = parse('[C4 E4 G4]:h [D4 F4 A4]:h')
    const score = buildScore(nodes, { tempo: 120 })
    const parts = score.getParts()
    const measures = parts[0].getVoices()[0].getMeasures()
    expect(measures).toHaveLength(1)
  })

  // Phase 2: Auto-split tests
  it('whole note in 3/4 auto-splits across measures with ties', () => {
    const nodes = parse('G4:w')
    const score = buildScore(nodes, { timeSignature: '3/4' })
    const parts = score.getParts()
    const measures = parts[0].getVoices()[0].getMeasures()
    // 4 beats split into 3/4 measures: first measure 3 beats, second 1 beat
    expect(measures).toHaveLength(2)
    const m1Notes = measures[0].getNotes()
    const m2Notes = measures[1].getNotes()
    expect(m1Notes).toHaveLength(1)
    expect(m2Notes).toHaveLength(1)
    // First fragment should be tied
    expect(m1Notes[0].tied).toBe(true)
    // Total beats should sum to 4
    expect(m1Notes[0].beats + m2Notes[0].beats).toBeCloseTo(4.0)
  })

  it('auto-split produces correct timeline duration', () => {
    const nodes = parse('G4:w')
    const score = buildScore(nodes, { tempo: 120, timeSignature: '3/4' })
    const timeline = Scheduler.buildTimeline(score)
    // Two fragments but total duration should be 4 beats = 2.0s at 120 BPM
    const totalDuration = timeline.reduce((max, e) => Math.max(max, e.time + e.note.duration), 0)
    expect(totalDuration).toBeCloseTo(2.0)
  })

  // Phase 2: Tempo map tests
  it('tempo change at measure 2 affects timing', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
    const score = buildScore(nodes, { tempo: 120 })
    score.tempoAt(2, 60) // slow down at measure 2

    const timeline = Scheduler.buildTimeline(score)
    // Measure 1: 4 quarters at 120 BPM = 2.0s
    // Measure 2: 4 quarters at 60 BPM = 4.0s
    const m1End = 2.0 // end of measure 1
    expect(timeline[4].time).toBeCloseTo(m1End) // first note of measure 2
    const last = timeline[timeline.length - 1]
    expect(last.time + last.note.duration).toBeCloseTo(6.0) // 2.0 + 4.0
  })

  it('getTempoAtMeasure walks back through tempo map', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q')
    const score = buildScore(nodes, { tempo: 120 })
    score.tempoAt(1, 90)
    score.tempoAt(3, 60)
    expect(score.getTempoAtMeasure(1)).toBe(90)
    expect(score.getTempoAtMeasure(2)).toBe(90) // inherits from measure 1
    expect(score.getTempoAtMeasure(3)).toBe(60)
    expect(score.getTempoAtMeasure(5)).toBe(60) // inherits from measure 3
  })
})
