import { describe, it, expect } from 'vitest'
import { parse } from '../../parser/index.js'
import { buildScore } from '../../model/converter.js'
import { Scheduler } from '../Scheduler.js'

describe('Scheduler.buildTimeline', () => {
  describe('timing - 4 quarter notes at 120 BPM', () => {
    it('returns 4 events', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline).toHaveLength(4)
    })

    it('first event starts at time 0', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].time).toBe(0)
    })

    it('second event starts at 0.5s (1 quarter at 120 BPM)', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[1].time).toBeCloseTo(0.5)
    })

    it('third event starts at 1.0s', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[2].time).toBeCloseTo(1.0)
    })

    it('fourth event starts at 1.5s', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[3].time).toBeCloseTo(1.5)
    })

    it('each quarter note duration = 0.5s at 120 BPM', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      timeline.forEach((event) => expect(event.note.duration).toBeCloseTo(0.5))
    })
  })

  describe('pitch formatting', () => {
    it('formats simple pitch correctly (C4)', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.pitch).toBe('C4')
    })

    it('formats second note pitch correctly (D4)', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[1].note.pitch).toBe('D4')
    })

    it('formats accidental pitches correctly (F#5)', () => {
      const score = buildScore(parse('F#5:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.pitch).toBe('F#5')
    })

    it('formats flat accidental correctly (Bb3)', () => {
      const score = buildScore(parse('Bb3:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.pitch).toBe('Bb3')
    })

    it('rest has null pitch', () => {
      const score = buildScore(parse('R:q C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.pitch).toBeNull()
    })
  })

  describe('duration calculations', () => {
    it('whole note at 60 BPM = 4.0s', () => {
      const score = buildScore(parse('C4:w'), { tempo: 60 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.duration).toBeCloseTo(4.0)
    })

    it('dotted half at 60 BPM = 3.0s', () => {
      const score = buildScore(parse('C4:h.'), { tempo: 60 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.duration).toBeCloseTo(3.0)
    })

    it('half note at 120 BPM = 1.0s', () => {
      const score = buildScore(parse('C4:h'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.duration).toBeCloseTo(1.0)
    })

    it('eighth note at 120 BPM = 0.25s', () => {
      const score = buildScore(parse('C4:e'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.duration).toBeCloseTo(0.25)
    })
  })

  describe('rests advance time', () => {
    it('rest has null pitch', () => {
      const score = buildScore(parse('R:q C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.pitch).toBeNull()
    })

    it('note after rest starts at correct offset', () => {
      const score = buildScore(parse('R:q C4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[1].time).toBeCloseTo(0.5)
    })

    it('rest still has duration', () => {
      const score = buildScore(parse('R:q C4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.duration).toBeCloseTo(0.5)
    })
  })

  describe('dynamic → velocity mapping', () => {
    it('ff maps to 112', () => {
      const score = buildScore(parse('C4:q(ff) D4:q(pp)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(112)
    })

    it('pp maps to 32', () => {
      const score = buildScore(parse('C4:q(ff) D4:q(pp)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[1].note.velocity).toBe(32)
    })

    it('ppp maps to 16', () => {
      const score = buildScore(parse('C4:q(ppp)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(16)
    })

    it('p maps to 48', () => {
      const score = buildScore(parse('C4:q(p)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(48)
    })

    it('mp maps to 64', () => {
      const score = buildScore(parse('C4:q(mp)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(64)
    })

    it('mf maps to 80', () => {
      const score = buildScore(parse('C4:q(mf)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(80)
    })

    it('f maps to 96', () => {
      const score = buildScore(parse('C4:q(f)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(96)
    })

    it('fff maps to 127', () => {
      const score = buildScore(parse('C4:q(fff)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(127)
    })

    it('no dynamic defaults to 64 (mp)', () => {
      const score = buildScore(parse('C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(64)
    })

    it('cresc maps to 80', () => {
      const score = buildScore(parse('C4:q(cresc)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(80)
    })

    it('decresc maps to 64', () => {
      const score = buildScore(parse('C4:q(decresc)'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.velocity).toBe(64)
    })
  })

  describe('NoteEvent metadata', () => {
    it('NoteEvent includes voice name', () => {
      const score = buildScore(parse('C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.voice).toBe('default')
    })

    it('NoteEvent includes measure number (1-indexed)', () => {
      const score = buildScore(parse('C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.measure).toBe(1)
    })

    it('note in second measure has measure=2', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[4].note.measure).toBe(2)
    })

    it('NoteEvent includes beat', () => {
      const score = buildScore(parse('C4:q D4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(typeof timeline[0].note.beat).toBe('number')
    })

    it('NoteEvent has tied flag', () => {
      const score = buildScore(parse('C4:q ~ D4:q'))
      const timeline = Scheduler.buildTimeline(score)
      // First note should be tied
      expect(typeof timeline[0].note.tied).toBe('boolean')
    })

    it('NoteEvent has chord flag', () => {
      const score = buildScore(parse('[C4 E4 G4]:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.chord).toBe(true)
    })

    it('NoteEvent has midi number for pitched notes', () => {
      const score = buildScore(parse('C4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.midi).toBe(60) // C4 = MIDI 60
    })

    it('NoteEvent has null midi for rests', () => {
      const score = buildScore(parse('R:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.midi).toBeNull()
    })

    it('NoteEvent has frequency for pitched notes', () => {
      const score = buildScore(parse('A4:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.frequency).toBeCloseTo(440)
    })

    it('NoteEvent has null frequency for rests', () => {
      const score = buildScore(parse('R:q'))
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[0].note.frequency).toBeNull()
    })
  })

  describe('timeline ordering', () => {
    it('timeline is sorted by time ascending', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].time).toBeGreaterThanOrEqual(timeline[i - 1].time)
      }
    })

    it('is stateless: same score always produces same timeline', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      const t1 = Scheduler.buildTimeline(score)
      const t2 = Scheduler.buildTimeline(score)
      expect(t1).toEqual(t2)
    })
  })

  describe('multi-measure timing', () => {
    it('notes in second measure have correct times', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'), { tempo: 120 })
      const timeline = Scheduler.buildTimeline(score)
      expect(timeline[4].time).toBeCloseTo(2.0) // 4 quarters at 120 BPM = 2s
      expect(timeline[5].time).toBeCloseTo(2.5)
      expect(timeline[6].time).toBeCloseTo(3.0)
      expect(timeline[7].time).toBeCloseTo(3.5)
    })
  })

  describe('repeat sections', () => {
    it('repeats unroll measures correctly', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'), { tempo: 120 })
      score.addRepeatSection(1, 2) // repeat both measures
      const timeline = Scheduler.buildTimeline(score)
      // 2 measures × 4 notes = 8, then repeat = 8 more = 16 total
      expect(timeline).toHaveLength(16)
    })

    it('repeat section replays notes at correct times', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      score.addRepeatSection(1, 1) // repeat measure 1
      const timeline = Scheduler.buildTimeline(score)
      // 4 original + 4 repeated = 8
      expect(timeline).toHaveLength(8)
      // Repeated notes start after the first pass (2s at 120 BPM for 4 quarters)
      expect(timeline[4].time).toBeCloseTo(2.0)
    })
  })

  describe('da capo', () => {
    it('da capo replays all measures from the start', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'), { tempo: 120 })
      score.setDaCapo(true)
      const timeline = Scheduler.buildTimeline(score)
      // 8 notes × 2 (play + da capo) = 16
      expect(timeline).toHaveLength(16)
    })

    it('da capo notes have correct timing after replay', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), { tempo: 120 })
      score.setDaCapo(true)
      const timeline = Scheduler.buildTimeline(score)
      // 4 original + 4 da capo = 8
      expect(timeline).toHaveLength(8)
      // Da capo replay starts at 2s (after first pass of 4 quarters at 120 BPM)
      expect(timeline[4].time).toBeCloseTo(2.0)
    })
  })

  describe('mergeTies', () => {
    it('merges consecutive tied notes into one', () => {
      const score = buildScore(parse('C4:q~ C4:q'), { tempo: 120 })
      const rawTimeline = Scheduler.buildTimeline(score)
      const merged = Scheduler.mergeTies(rawTimeline)
      // Two C4 quarters tied → one event with combined duration
      expect(merged).toHaveLength(1)
      expect(merged[0].note.duration).toBeCloseTo(1.0) // 0.5 + 0.5 at 120 BPM
    })

    it('preserves non-tied notes', () => {
      const score = buildScore(parse('C4:q D4:q'), { tempo: 120 })
      const merged = Scheduler.mergeTies(Scheduler.buildTimeline(score))
      expect(merged).toHaveLength(2)
    })
  })
})
