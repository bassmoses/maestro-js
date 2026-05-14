import { describe, it, expect } from 'vitest'
import { tokenize } from '../tokenizer.js'
import { parse } from '../parser.js'
import { MaestroError } from '../errors.js'

describe('tokenizer — percussion', () => {
  it('tokenizes X<SNARE>:q as PERCUSSION token', () => {
    const tokens = tokenize('X<SNARE>:q')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('PERCUSSION')
    expect(tokens[0].raw).toBe('X<SNARE>:q')
  })
  it('tokenizes X<KICK>:e as PERCUSSION token', () => {
    const tokens = tokenize('X<KICK>:e')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('PERCUSSION')
  })
  it('tokenizes X<HIHAT>:s. with dot', () => {
    const tokens = tokenize('X<HIHAT>:s.')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].raw).toBe('X<HIHAT>:s.')
  })
  it('tokenizes X<SNARE> without duration as PERCUSSION', () => {
    const tokens = tokenize('X<SNARE>')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('PERCUSSION')
    expect(tokens[0].raw).toBe('X<SNARE>')
  })
  it('tokenizes multiple percussion notes', () => {
    const tokens = tokenize('X<KICK>:q X<SNARE>:q X<HIHAT>:e X<HIHAT>:e')
    expect(tokens).toHaveLength(4)
    expect(tokens.every((t) => t.type === 'PERCUSSION')).toBe(true)
  })
  it('throws MaestroError for unknown drum name', () => {
    expect(() => tokenize('X<COWBELL>:q')).toThrow(MaestroError)
  })
})

describe('parser — percussion', () => {
  it('parses X<SNARE>:q to percussion NoteNode', () => {
    const nodes = parse('X<SNARE>:q')
    expect(nodes).toHaveLength(1)
    const n = nodes[0]
    expect(n.type).toBe('note')
    expect(n.percussion).toBe('SNARE')
    expect(n.duration).toBe('q')
    expect(n.dotted).toBe(false)
    expect(n.isBarline).toBe(false)
  })
  it('parses X<KICK>:e. with dotted flag', () => {
    const nodes = parse('X<KICK>:e.')
    expect(nodes[0].percussion).toBe('KICK')
    expect(nodes[0].dotted).toBe(true)
    expect(nodes[0].duration).toBe('e')
  })
  it('parses percussion measure with barlines', () => {
    const nodes = parse(
      'X<KICK>:q X<SNARE>:q X<KICK>:q X<SNARE>:q | X<KICK>:q X<SNARE>:q X<KICK>:q X<SNARE>:q'
    )
    const notes = nodes.filter((n) => !n.isBarline)
    expect(notes).toHaveLength(8)
    expect(notes.every((n) => n.percussion !== undefined)).toBe(true)
  })
  it('parses dynamic on percussion note', () => {
    const nodes = parse('X<SNARE>:q(f)')
    expect(nodes[0].percussion).toBe('SNARE')
    expect(nodes[0].dynamic).toBe('f')
  })
})
