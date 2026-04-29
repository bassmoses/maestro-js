import { describe, it, expect } from 'vitest'
import { buildStaveLayout, buildScoreLayout, TITLE_HEIGHT } from '../StaveBuilder.js'
import { buildScore } from '../../../model/converter.js'
import { parse } from '../../../parser/parser.js'

describe('StaveBuilder', () => {
  describe('buildStaveLayout', () => {
    it('creates one line for 4 or fewer measures', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const voice = score.getParts()[0].getVoices()[0]
      const layout = buildStaveLayout(voice, { measuresPerLine: 4 })
      expect(layout.lines).toHaveLength(1)
    })

    it('wraps to multiple lines when measures exceed measuresPerLine', () => {
      const notation =
        'C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | D5:q E5:q F5:q G5:q | A5:q B5:q C6:q D6:q | E4:q F4:q G4:q A4:q'
      const score = buildScore(parse(notation))
      const voice = score.getParts()[0].getVoices()[0]
      const layout = buildStaveLayout(voice, { measuresPerLine: 2 })
      expect(layout.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('measureStartIndex is 1-based', () => {
      const notation =
        'C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | D5:q E5:q F5:q G5:q | A5:q B5:q C6:q D6:q | E4:q F4:q G4:q A4:q'
      const score = buildScore(parse(notation))
      const voice = score.getParts()[0].getVoices()[0]
      const layout = buildStaveLayout(voice, { measuresPerLine: 2 })
      expect(layout.lines[0].measureStartIndex).toBe(1)
      expect(layout.lines[1].measureStartIndex).toBe(3)
    })

    it('calculates staveWidth from width minus padding', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const voice = score.getParts()[0].getVoices()[0]
      const layout = buildStaveLayout(voice, { width: 800, padding: 20 })
      expect(layout.staveWidth).toBe(760)
    })

    it('handles empty voice gracefully', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const part = score.addPart('empty')
      const emptyVoice = part.addVoice('empty', 'treble')
      const layout = buildStaveLayout(emptyVoice)
      expect(layout.lines).toHaveLength(0)
    })
  })

  describe('buildScoreLayout', () => {
    it('calculates layout for single-voice score', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const result = buildScoreLayout(score)
      expect(result.voiceLayouts).toHaveLength(1)
      expect(result.totalHeight).toBeGreaterThan(0)
    })

    it('adds title height when title is present', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), {
        title: 'Test Song',
      })
      const result = buildScoreLayout(score)
      expect(result.titleHeight).toBe(TITLE_HEIGHT)
    })

    it('no title height when title is empty', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const result = buildScoreLayout(score)
      expect(result.titleHeight).toBe(0)
    })

    it('adds composer triggers title height', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'), {
        composer: 'Test Composer',
      })
      const result = buildScoreLayout(score)
      expect(result.titleHeight).toBe(TITLE_HEIGHT)
    })
  })
})
