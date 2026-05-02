import { describe, it, expect } from 'vitest'
import { parse } from '../../parser/index.js'
import { buildScore } from '../../model/converter.js'
import { Scheduler } from '../Scheduler.js'

/**
 * Tests for hairpin dynamic velocity interpolation.
 *
 * The Scheduler post-processes cresc/decresc passages after building the
 * timeline, interpolating velocities linearly between the surrounding
 * explicit dynamics.
 *
 * Dynamic→velocity map:
 *   ppp=16, pp=32, p=48, mp=64, mf=80, f=96, ff=112, fff=127
 *
 * Defaults when no surrounding explicit dynamic:
 *   start: mp (64)
 *   cresc end: f (96)
 *   decresc end: p (48)
 */
describe('Scheduler — hairpin velocity interpolation', () => {
  describe('cresc passage p → f', () => {
    it('four cresc notes between p and f interpolate linearly', () => {
      // Layout: p C4, cresc C4, cresc D4, cresc E4, cresc F4, f G4
      // startVel=p(48), endVel=f(96)
      // cresc run indices 0..3 (4 notes), t = 0/3, 1/3, 2/3, 3/3
      // velocities: 48, 64, 80, 96
      const score = buildScore(parse('C4:q(p) C4:q(p<) D4:q(p<) E4:q(p<) F4:q(p<) G4:q(f)'))
      const timeline = Scheduler.buildTimeline(score)

      // Notes are sorted by time; indices 1–4 are the cresc notes
      const crescNotes = timeline.slice(1, 5)
      expect(crescNotes[0].note.velocity).toBe(48)
      expect(crescNotes[1].note.velocity).toBe(64)
      expect(crescNotes[2].note.velocity).toBe(80)
      expect(crescNotes[3].note.velocity).toBe(96)
    })

    it('velocities increase monotonically across the cresc passage', () => {
      const score = buildScore(parse('C4:q(p) C4:q(p<) D4:q(p<) E4:q(p<) G4:q(f)'))
      const timeline = Scheduler.buildTimeline(score)
      const crescNotes = timeline.slice(1, 4)
      for (let i = 1; i < crescNotes.length; i++) {
        expect(crescNotes[i].note.velocity).toBeGreaterThan(crescNotes[i - 1].note.velocity)
      }
    })
  })

  describe('decresc passage f → p', () => {
    it('four decresc notes between f and p interpolate linearly', () => {
      // startVel=f(96), endVel=p(48)
      // t = 0/3, 1/3, 2/3, 3/3 → 96, 80, 64, 48
      const score = buildScore(parse('C4:q(f) C4:q(f>) D4:q(f>) E4:q(f>) F4:q(f>) G4:q(p)'))
      const timeline = Scheduler.buildTimeline(score)
      const decrescNotes = timeline.slice(1, 5)
      expect(decrescNotes[0].note.velocity).toBe(96)
      expect(decrescNotes[1].note.velocity).toBe(80)
      expect(decrescNotes[2].note.velocity).toBe(64)
      expect(decrescNotes[3].note.velocity).toBe(48)
    })

    it('velocities decrease monotonically across the decresc passage', () => {
      const score = buildScore(parse('C4:q(f) C4:q(f>) D4:q(f>) E4:q(f>) G4:q(p)'))
      const timeline = Scheduler.buildTimeline(score)
      const decrescNotes = timeline.slice(1, 4)
      for (let i = 1; i < decrescNotes.length; i++) {
        expect(decrescNotes[i].note.velocity).toBeLessThan(decrescNotes[i - 1].note.velocity)
      }
    })
  })

  describe('cresc with no prior explicit dynamic', () => {
    it('assumes mp (64) as start velocity', () => {
      // No prior dynamic → startVel = 64 (mp); following f → endVel = 96
      // Two cresc notes: t=0 → 64, t=1 → 96
      const score = buildScore(parse('C4:q(p<) D4:q(p<) E4:q(f)'))
      const timeline = Scheduler.buildTimeline(score)
      const crescNotes = timeline.slice(0, 2)
      expect(crescNotes[0].note.velocity).toBe(64)
      expect(crescNotes[1].note.velocity).toBe(96)
    })

    it('single cresc note with no surrounding dynamics gets mp (64)', () => {
      // startVel=mp(64), endVel=f(96), runLength=1, t=0 → 64
      const score = buildScore(parse('C4:q(p<)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(64)
    })
  })

  describe('cresc at end with no following dynamic', () => {
    it('assumes f (96) as end velocity', () => {
      // Prior p (48) → startVel=48; no following → endVel=f(96)
      // Three cresc notes: t=0/2, 1/2, 2/2 → 48, 72, 96
      const score = buildScore(parse('C4:q(p) D4:q(p<) E4:q(p<) F4:q(p<)'))
      const timeline = Scheduler.buildTimeline(score)
      const crescNotes = timeline.slice(1, 4)
      expect(crescNotes[0].note.velocity).toBe(48)
      expect(crescNotes[1].note.velocity).toBe(72)
      expect(crescNotes[2].note.velocity).toBe(96)
    })
  })

  describe('decresc with no following dynamic', () => {
    it('assumes p (48) as end velocity', () => {
      // Prior f (96) → startVel=96; no following → endVel=p(48)
      // Three decresc notes: t=0/2, 1/2, 2/2 → 96, 72, 48
      const score = buildScore(parse('C4:q(f) D4:q(f>) E4:q(f>) F4:q(f>)'))
      const timeline = Scheduler.buildTimeline(score)
      const decrescNotes = timeline.slice(1, 4)
      expect(decrescNotes[0].note.velocity).toBe(96)
      expect(decrescNotes[1].note.velocity).toBe(72)
      expect(decrescNotes[2].note.velocity).toBe(48)
    })
  })

  describe('velocities are clamped to [16, 127]', () => {
    it('cresc ending past fff is clamped to 127', () => {
      // startVel=fff(127), endVel=f(96) default cresc end, but start is already 127
      // runLength=1, t=0 → 127
      const score = buildScore(parse('C4:q(fff) D4:q(p<)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[1].note.velocity).toBeGreaterThanOrEqual(16)
      expect(timeline[1].note.velocity).toBeLessThanOrEqual(127)
    })
  })

  describe('NoteEvent carries dynamic field', () => {
    it('cresc notes have dynamic = "cresc"', () => {
      const score = buildScore(parse('C4:q(p<) D4:q(p<)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.dynamic).toBe('cresc')
      expect(timeline[1].note.dynamic).toBe('cresc')
    })

    it('non-hairpin notes carry their dynamic', () => {
      const score = buildScore(parse('C4:q(f) D4:q(p)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.dynamic).toBe('f')
      expect(timeline[1].note.dynamic).toBe('p')
    })

    it('notes with no dynamic have dynamic = null', () => {
      const score = buildScore(parse('C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.dynamic).toBeNull()
    })
  })
})
