import { describe, it, expect } from 'vitest'
import { Score } from '../../model/Score.js'
import { Note } from '../../model/Note.js'
import { Scheduler } from '../Scheduler.js'
import type { TimeSignature } from '../../model/Measure.js'
import type { PitchName, Octave } from '../../model/types.js'

function n(pitch: PitchName, octave: Octave, duration: 'q' | 'h' | 'w' | 'e' | 's') {
  return new Note({
    pitch,
    accidental: null,
    octave,
    duration,
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    chord: false,
    fermata: false,
    breath: false,
    triplet: false,
  })
}

describe('Scheduler pickup measure', () => {
  it('pickup note plays at time 0 and full measure notes follow', () => {
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    score.setPickup(true)
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    // One quarter pickup note, then 4 quarter notes in full measure
    voice.addNote(n('E', 4, 'q'), ts, true)
    voice.closePickupMeasure()
    for (let i = 0; i < 4; i++) {
      voice.addNote(n('C', 4, 'q'), ts, false)
    }

    const timeline = Scheduler.buildTimeline(score)
    // pickup note at t=0, duration=1s (60bpm, quarter note)
    expect(timeline[0].time).toBeCloseTo(0)
    expect(timeline[0].note.duration).toBeCloseTo(1.0)
    // first full-measure note starts at t=1 (after 1 beat pickup at 60bpm)
    expect(timeline[1].time).toBeCloseTo(1.0)
  })

  it('pickup measure index is 1, full measure starts at 2', () => {
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    score.setPickup(true)
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    voice.addNote(n('E', 4, 'q'), ts, true)
    voice.closePickupMeasure()
    for (let i = 0; i < 4; i++) {
      voice.addNote(n('C', 4, 'q'), ts, false)
    }

    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.measure).toBe(1)
    expect(timeline[1].note.measure).toBe(2)
  })

  it('half-note pickup contributes 2 beats duration before full measure', () => {
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    score.setPickup(true)
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    // Half note pickup (2 beats = 2s at 60bpm)
    voice.addNote(n('G', 4, 'h'), ts, true)
    voice.closePickupMeasure()
    for (let i = 0; i < 4; i++) {
      voice.addNote(n('C', 4, 'q'), ts, false)
    }

    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.duration).toBeCloseTo(2.0) // half note = 2s at 60bpm
    expect(timeline[1].time).toBeCloseTo(2.0) // full measure starts after 2s
  })
})

describe('Scheduler multi-measure rest', () => {
  it('multi-measure rest contributes N full measures of time, no note events emitted', () => {
    // At 60bpm, 4/4: 1 measure = 4 beats = 4 seconds
    // R:2m should contribute 8 seconds of silence, no note events
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    // Add multi-measure rest (2 measures)
    voice.addNote(
      new Note({
        pitch: 'R' as PitchName,
        accidental: null,
        octave: 4 as Octave,
        duration: 'w',
        dotted: false,
        dynamic: null,
        tied: false,
        slurred: false,
        chord: false,
        fermata: false,
        breath: false,
        triplet: false,
        multiMeasureRest: 2,
      }),
      ts,
      true
    )

    // Note after the rest
    voice.addNote(n('C', 4, 'q'), ts, false)

    const timeline = Scheduler.buildTimeline(score)
    // The multi-measure rest should produce NO note events
    // The C4 note after should start at t=8 (2 measures × 4 beats × 1s/beat at 60bpm)
    const nonRestEvents = timeline.filter((e) => e.note.pitch !== null)
    expect(nonRestEvents).toHaveLength(1)
    expect(nonRestEvents[0].time).toBeCloseTo(8.0)
  })

  it('multi-measure rest with 4 measures advances time by 4 full measure durations', () => {
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    voice.addNote(
      new Note({
        pitch: 'R' as PitchName,
        accidental: null,
        octave: 4 as Octave,
        duration: 'w',
        dotted: false,
        dynamic: null,
        tied: false,
        slurred: false,
        chord: false,
        fermata: false,
        breath: false,
        triplet: false,
        multiMeasureRest: 4,
      }),
      ts,
      true
    )

    voice.addNote(n('G', 4, 'q'), ts, false)

    const timeline = Scheduler.buildTimeline(score)
    const nonRestEvents = timeline.filter((e) => e.note.pitch !== null)
    // 4 measures × 4 beats × 1s = 16s
    expect(nonRestEvents[0].time).toBeCloseTo(16.0)
  })
})
