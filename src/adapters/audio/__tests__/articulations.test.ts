import { describe, it, expect } from 'vitest'
import { parse } from '../../../parser/index.js'
import { buildScore } from '../../../model/converter.js'
import { Scheduler } from '../../../scheduler/Scheduler.js'

/**
 * Tests for articulation effects on playback (duration and velocity).
 * Articulation logic lives in Scheduler.buildTimeline, which is what
 * ToneAdapter uses to drive Tone.js.
 *
 * Baseline: quarter note at 120 BPM = 0.5s, default velocity = 64 (mp).
 */

function buildTimeline(notation: string) {
  const score = buildScore(parse(notation), { tempo: 120 })
  return Scheduler.buildTimeline(score)
}

describe('Articulation audio effects', () => {
  const BASE_DURATION = 0.5 // quarter at 120 BPM in seconds
  const BASE_VELOCITY = 64 // mp default

  describe('staccato', () => {
    it('halves the note duration', () => {
      const timeline = buildTimeline('C4:q(staccato)')
      expect(timeline[0].note.duration).toBeCloseTo(BASE_DURATION * 0.5)
    })

    it('does not change velocity', () => {
      const timeline = buildTimeline('C4:q(staccato)')
      expect(timeline[0].note.velocity).toBe(BASE_VELOCITY)
    })
  })

  describe('accent', () => {
    it('does not change duration', () => {
      const timeline = buildTimeline('C4:q(accent)')
      expect(timeline[0].note.duration).toBeCloseTo(BASE_DURATION)
    })

    it('adds +20 to velocity', () => {
      const timeline = buildTimeline('C4:q(accent)')
      expect(timeline[0].note.velocity).toBe(BASE_VELOCITY + 20)
    })

    it('clamps velocity to 127 when base is near max', () => {
      // fff = 127; accent should not exceed 127
      const timeline = buildTimeline('C4:q(fff)(accent)')
      expect(timeline[0].note.velocity).toBe(127)
    })
  })

  describe('tenuto', () => {
    it('does not change duration', () => {
      const timeline = buildTimeline('C4:q(tenuto)')
      expect(timeline[0].note.duration).toBeCloseTo(BASE_DURATION)
    })

    it('adds +5 to velocity', () => {
      const timeline = buildTimeline('C4:q(tenuto)')
      expect(timeline[0].note.velocity).toBe(BASE_VELOCITY + 5)
    })
    // tenuto +5 clamping (127+5→127) is covered by the shared Math.min(127,...) path, same as accent/marcato
  })

  describe('marcato', () => {
    it('halves the note duration', () => {
      const timeline = buildTimeline('C4:q(marcato)')
      expect(timeline[0].note.duration).toBeCloseTo(BASE_DURATION * 0.5)
    })

    it('adds +30 to velocity', () => {
      const timeline = buildTimeline('C4:q(marcato)')
      expect(timeline[0].note.velocity).toBe(BASE_VELOCITY + 30)
    })

    it('clamps velocity to 127 when base + 30 > 127', () => {
      // ff = 112; 112 + 30 = 142 → clamped to 127
      const timeline = buildTimeline('C4:q(ff)(marcato)')
      expect(timeline[0].note.velocity).toBe(127)
    })
  })

  describe('no articulation', () => {
    it('uses full duration with no articulation', () => {
      const timeline = buildTimeline('C4:q')
      expect(timeline[0].note.duration).toBeCloseTo(BASE_DURATION)
    })

    it('uses base velocity with no articulation', () => {
      const timeline = buildTimeline('C4:q')
      expect(timeline[0].note.velocity).toBe(BASE_VELOCITY)
    })
  })
})
