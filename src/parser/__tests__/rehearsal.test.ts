import { describe, it, expect } from 'vitest'
import { tokenize } from '../tokenizer.js'
import { parse } from '../parser.js'
import { buildScore } from '../../model/converter.js'

// ─── Breath marks ────────────────────────────────────────────────

describe('Breath marks', () => {
  describe('tokenizer', () => {
    it('tokenizes a note with (breath) as a NOTE token', () => {
      const tokens = tokenize('C4:q(breath)')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('NOTE')
      expect(tokens[0].raw).toBe('C4:q(breath)')
    })

    it('tokenizes (breath) combined with a dynamic', () => {
      const tokens = tokenize('C4:q(mp)(breath)')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('NOTE')
    })
  })

  describe('parser', () => {
    it('parses C4:q(breath) with breath=true', () => {
      const nodes = parse('C4:q(breath)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].breath).toBe(true)
      expect(nodes[0].pitch).toBe('C')
      expect(nodes[0].octave).toBe(4)
    })

    it('parses a plain note with breath=undefined (falsy)', () => {
      const nodes = parse('C4:q')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].breath).toBeFalsy()
    })

    it('parses breath combined with dynamic', () => {
      const nodes = parse('C4:q(mp)(breath)')
      expect(nodes[0].breath).toBe(true)
      expect(nodes[0].dynamic).toBe('mp')
    })

    it('parses breath combined with fermata', () => {
      const nodes = parse('C4:q(fermata)(breath)')
      expect(nodes[0].fermata).toBe(true)
      expect(nodes[0].breath).toBe(true)
    })
  })
})

// ─── Expression text ─────────────────────────────────────────────

describe('Expression text', () => {
  describe('tokenizer', () => {
    it('tokenizes {soli} as EXPRESSION_TEXT', () => {
      const tokens = tokenize('C4:q{soli}')
      expect(tokens).toHaveLength(2)
      expect(tokens[0].type).toBe('NOTE')
      expect(tokens[1].type).toBe('EXPRESSION_TEXT')
      expect(tokens[1].raw).toBe('{soli}')
    })

    it('tokenizes {tutti} as EXPRESSION_TEXT', () => {
      const tokens = tokenize('D4:h{tutti}')
      expect(tokens[1].type).toBe('EXPRESSION_TEXT')
      expect(tokens[1].raw).toBe('{tutti}')
    })

    it('tokenizes {a tempo} as EXPRESSION_TEXT', () => {
      const tokens = tokenize('E4:q{a tempo}')
      expect(tokens[1].type).toBe('EXPRESSION_TEXT')
      expect(tokens[1].raw).toBe('{a tempo}')
    })

    it('does not confuse triplet {C4 D4 E4}:q with expression text', () => {
      const tokens = tokenize('{C4 D4 E4}:q')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('TRIPLET')
    })
  })

  describe('parser', () => {
    it('attaches expression text to the preceding note', () => {
      const nodes = parse('C4:q{soli}')
      // Expression text attaches to the note before it; no separate node produced
      const noteNodes = nodes.filter((n) => !n.isBarline)
      expect(noteNodes).toHaveLength(1)
      expect(noteNodes[0].expression).toBe('soli')
    })

    it('attaches {tutti} expression text', () => {
      const nodes = parse('D4:h{tutti}')
      expect(nodes[0].expression).toBe('tutti')
    })

    it('attaches multi-word expression text', () => {
      const nodes = parse('E4:q{a tempo}')
      expect(nodes[0].expression).toBe('a tempo')
    })

    it('plain note has no expression', () => {
      const nodes = parse('C4:q')
      expect(nodes[0].expression).toBeUndefined()
    })
  })
})

// ─── Rehearsal marks ─────────────────────────────────────────────

describe('Rehearsal marks', () => {
  describe('tokenizer', () => {
    it('tokenizes [A] as REHEARSAL_MARK', () => {
      const tokens = tokenize('[A]')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('REHEARSAL_MARK')
      expect(tokens[0].raw).toBe('[A]')
    })

    it('tokenizes [B] as REHEARSAL_MARK', () => {
      const tokens = tokenize('[B]')
      expect(tokens[0].type).toBe('REHEARSAL_MARK')
    })

    it('tokenizes [1] as REHEARSAL_MARK', () => {
      const tokens = tokenize('[1]')
      expect(tokens[0].type).toBe('REHEARSAL_MARK')
    })

    it('tokenizes [12] as REHEARSAL_MARK', () => {
      const tokens = tokenize('[12]')
      expect(tokens[0].type).toBe('REHEARSAL_MARK')
    })

    it('does not confuse chord [C4 E4 G4]:q with rehearsal mark', () => {
      const tokens = tokenize('[C4 E4 G4]:q')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('CHORD')
    })
  })

  describe('parser', () => {
    it('parses [A] as a barline node with rehearsalMark="A"', () => {
      const nodes = parse('[A] C4:q')
      const barline = nodes.find((n) => n.isBarline && n.rehearsalMark === 'A')
      expect(barline).toBeDefined()
      expect(barline?.rehearsalMark).toBe('A')
    })

    it('parses [B] before a barline: [B]| C4:q', () => {
      const nodes = parse('[B]| C4:q')
      const barline = nodes.find((n) => n.isBarline && n.rehearsalMark === 'B')
      expect(barline).toBeDefined()
    })
  })

  describe('model — measure.rehearsalMark', () => {
    it('measure 2 has rehearsalMark="A" when notation is | [A] C4:q', () => {
      // 4/4 score: first measure has one whole note, second starts with rehearsal mark A
      const nodes = parse('C4:w | [A] C4:w')
      const score = buildScore(nodes)
      const voice = score.getParts()[0].getVoices()[0]
      const measures = voice.getMeasures()
      expect(measures).toHaveLength(2)
      expect(measures[1].rehearsalMark).toBe('A')
    })

    it('first measure has rehearsalMark="B" when notation starts with [B]', () => {
      const nodes = parse('[B] C4:w')
      const score = buildScore(nodes)
      const voice = score.getParts()[0].getVoices()[0]
      const measures = voice.getMeasures()
      expect(measures[0].rehearsalMark).toBe('B')
    })

    it('measures without rehearsal marks have rehearsalMark=null', () => {
      const nodes = parse('C4:w | D4:w')
      const score = buildScore(nodes)
      const voice = score.getParts()[0].getVoices()[0]
      const measures = voice.getMeasures()
      expect(measures[0].rehearsalMark).toBeNull()
      expect(measures[1].rehearsalMark).toBeNull()
    })
  })
})
