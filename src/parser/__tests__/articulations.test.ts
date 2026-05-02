import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'

describe('Articulations parser', () => {
  describe('single articulations', () => {
    it('parses staccato', () => {
      const nodes = parse('C4:q(staccato)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('staccato')
    })

    it('parses accent', () => {
      const nodes = parse('C4:q(accent)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('accent')
    })

    it('parses tenuto', () => {
      const nodes = parse('C4:q(tenuto)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('tenuto')
    })

    it('parses marcato', () => {
      const nodes = parse('C4:q(marcato)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('marcato')
    })
  })

  describe('note without articulation', () => {
    it('has null/falsy articulation when no modifier', () => {
      const nodes = parse('C4:q')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation ?? null).toBeNull()
    })

    it('has null/falsy articulation when dynamic is present instead', () => {
      const nodes = parse('C4:q(mf)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].dynamic).toBe('mf')
      expect(nodes[0].articulation ?? null).toBeNull()
    })

    it('has null/falsy articulation when fermata is present', () => {
      const nodes = parse('C4:q(fermata)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].fermata).toBe(true)
      expect(nodes[0].articulation ?? null).toBeNull()
    })
  })

  describe('articulation combined with other modifiers', () => {
    it('parses staccato + fermata together', () => {
      const nodes = parse('C4:q(staccato)(fermata)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('staccato')
      expect(nodes[0].fermata).toBe(true)
    })

    it('parses fermata + staccato together (reversed order)', () => {
      const nodes = parse('C4:q(fermata)(staccato)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].fermata).toBe(true)
      expect(nodes[0].articulation).toBe('staccato')
    })

    it('parses accent + fermata together', () => {
      const nodes = parse('C4:q(accent)(fermata)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('accent')
      expect(nodes[0].fermata).toBe(true)
    })

    it('parses marcato on a dotted half note', () => {
      const nodes = parse('G4:h.(marcato)')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].articulation).toBe('marcato')
      expect(nodes[0].dotted).toBe(true)
      expect(nodes[0].duration).toBe('h')
    })
  })

  describe('multiple notes with articulations', () => {
    it('parses a phrase with mixed articulations', () => {
      const nodes = parse('C4:q(staccato) D4:q(accent) E4:q(tenuto) F4:q')
      expect(nodes).toHaveLength(4)
      expect(nodes[0].articulation).toBe('staccato')
      expect(nodes[1].articulation).toBe('accent')
      expect(nodes[2].articulation).toBe('tenuto')
      expect(nodes[3].articulation ?? null).toBeNull()
    })
  })
})
