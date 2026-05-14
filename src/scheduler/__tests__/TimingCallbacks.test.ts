import { describe, it, expect } from 'vitest'
import { TimingCallbacks } from '../TimingCallbacks.js'
import type { Timeline } from '../timeline.js'

function makeTimeline(): Timeline {
  return [
    {
      time: 0,
      note: {
        pitch: 'C4',
        midi: 60,
        frequency: 261.63,
        duration: 1.0,
        velocity: 64,
        dynamic: null,
        voice: 'right',
        measure: 1,
        beat: 0,
        tied: false,
        chord: false,
      },
    },
    {
      time: 1.0,
      note: {
        pitch: 'E4',
        midi: 64,
        frequency: 329.63,
        duration: 1.0,
        velocity: 64,
        dynamic: null,
        voice: 'right',
        measure: 1,
        beat: 1,
        tied: false,
        chord: false,
      },
    },
    {
      time: 2.0,
      note: {
        pitch: 'G4',
        midi: 67,
        frequency: 392.0,
        duration: 2.0,
        velocity: 64,
        dynamic: null,
        voice: 'right',
        measure: 2,
        beat: 0,
        tied: false,
        chord: false,
      },
    },
  ]
}

describe('TimingCallbacks', () => {
  it('constructs without error', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc).toBeDefined()
  })

  it('getNoteAt returns correct event at t=0.5 (C4)', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const event = tc.getNoteAt(0.5)
    expect(event?.pitches[0]).toBe('C4')
  })

  it('getNoteAt returns null before first note', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc.getNoteAt(-0.1)).toBeNull()
  })

  it('getNoteAt returns E4 at t=1.5', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const event = tc.getNoteAt(1.5)
    expect(event?.pitches[0]).toBe('E4')
  })

  it('getProgress returns 0 at t=0', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc.getProgress(0)).toBeCloseTo(0)
  })

  it('getProgress returns 1 at end (last note end time)', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const endTime = 2.0 + 2.0 // last note start + duration
    expect(tc.getProgress(endTime)).toBeCloseTo(1)
  })

  it('buildNoteEvents maps 3 timeline events to 3 NoteTimingEvents', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const events = tc.buildNoteEvents()
    expect(events).toHaveLength(3)
  })

  it('buildNoteEvents: first event has measureIndex=0 (0-based)', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const events = tc.buildNoteEvents()
    expect(events[0].measureIndex).toBe(0)
  })

  it('buildNoteEvents: third event has measureIndex=1 (measure 2 → index 1)', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const events = tc.buildNoteEvents()
    expect(events[2].measureIndex).toBe(1)
  })

  it('buildNoteEvents: pitches are wrapped in array', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const events = tc.buildNoteEvents()
    expect(events[0].pitches).toEqual(['C4'])
  })

  it('duration getter returns total timeline duration', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    // last note at t=2.0, duration=2.0s → total = 4.0
    expect(tc.duration).toBeCloseTo(4.0)
  })

  it('options getter returns the callbacks object', () => {
    const callbacks = { onEnd: () => {} }
    const tc = new TimingCallbacks(makeTimeline(), callbacks)
    expect(tc.options).toBe(callbacks)
  })
})
