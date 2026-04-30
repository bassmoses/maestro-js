import { describe, it, expect } from 'vitest'
import { tokenize } from '../tokenizer.js'
import { parse } from '../parser.js'

describe('Lyrics', () => {
  describe('tokenizer', () => {
    it('tokenizes a note with a lyric', () => {
      const tokens = tokenize('C4:q"hello"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('NOTE')
      expect(tokens[0].raw).toBe('C4:q"hello"')
    })

    it('tokenizes multiple notes with lyrics', () => {
      const tokens = tokenize('C4:q"hel" D4:q"lo"')
      expect(tokens).toHaveLength(2)
      expect(tokens[0].raw).toBe('C4:q"hel"')
      expect(tokens[1].raw).toBe('D4:q"lo"')
    })

    it('tokenizes a note without lyric normally', () => {
      const tokens = tokenize('C4:q')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].raw).toBe('C4:q')
    })

    it('tokenizes a chord with a lyric', () => {
      const tokens = tokenize('[C4 E4 G4]:q"joy"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('CHORD')
      expect(tokens[0].raw).toContain('"joy"')
    })

    it('tokenizes note with dynamic and lyric', () => {
      const tokens = tokenize('C4:q(mf)"world"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].raw).toBe('C4:q(mf)"world"')
    })
  })

  describe('parser', () => {
    it('parses a note with a lyric', () => {
      const nodes = parse('C4:q"hello"')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].lyric).toBe('hello')
      expect(nodes[0].pitch).toBe('C')
      expect(nodes[0].octave).toBe(4)
    })

    it('parses a note without lyric (lyric is undefined)', () => {
      const nodes = parse('C4:q')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].lyric).toBeUndefined()
    })

    it('parses notes with and without lyrics mixed', () => {
      const nodes = parse('C4:q"hel" D4:q E4:q"lo"')
      expect(nodes[0].lyric).toBe('hel')
      expect(nodes[1].lyric).toBeUndefined()
      expect(nodes[2].lyric).toBe('lo')
    })

    it('parses chord with lyric on first note', () => {
      const nodes = parse('[C4 E4 G4]:q"joy"')
      const chordNotes = nodes.filter((n) => n.chord)
      expect(chordNotes[0].lyric).toBe('joy')
      // Only first note of chord gets the lyric
      expect(chordNotes[1].lyric).toBeUndefined()
      expect(chordNotes[2].lyric).toBeUndefined()
    })

    it('parses note with dynamic and lyric', () => {
      const nodes = parse('C4:q(mf)"world"')
      expect(nodes[0].dynamic).toBe('mf')
      expect(nodes[0].lyric).toBe('world')
    })

    it('handles empty lyric string', () => {
      const nodes = parse('C4:q""')
      expect(nodes[0].lyric).toBe('')
    })

    it('handles lyric with spaces', () => {
      const nodes = parse('C4:q"two words"')
      expect(nodes[0].lyric).toBe('two words')
    })
  })
})
