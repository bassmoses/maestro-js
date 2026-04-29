import { describe, it, expect } from 'vitest'
import { Score } from '../Score.js'

describe('Score defaults', () => {
  it('tempo defaults to 120', () => {
    expect(new Score().tempo).toBe(120)
  })
  it('timeSignature defaults to 4/4', () => {
    expect(new Score().timeSignature).toEqual({ beats: 4, noteValue: 'q' })
  })
  it('key defaults to C', () => {
    expect(new Score().key).toBe('C')
  })
  it('title defaults to empty string', () => {
    expect(new Score().title).toBe('')
  })
  it('composer defaults to empty string', () => {
    expect(new Score().composer).toBe('')
  })
  it('no parts by default', () => {
    expect(new Score().getParts()).toHaveLength(0)
  })
})

describe('Score with options', () => {
  it('accepts custom tempo', () => {
    expect(new Score({ tempo: 90 }).tempo).toBe(90)
  })
  it('accepts custom key', () => {
    expect(new Score({ key: 'Bb' }).key).toBe('Bb')
  })
  it('accepts title', () => {
    expect(new Score({ title: 'Symphony No. 1' }).title).toBe('Symphony No. 1')
  })
  it('accepts composer', () => {
    expect(new Score({ composer: 'Mozart' }).composer).toBe('Mozart')
  })
  it('accepts custom timeSignature string', () => {
    expect(new Score({ timeSignature: '3/4' }).timeSignature).toEqual({ beats: 3, noteValue: 'q' })
  })
})

describe('Score.parseTimeSignature', () => {
  it('parses 4/4', () => {
    expect(Score.parseTimeSignature('4/4')).toEqual({ beats: 4, noteValue: 'q' })
  })
  it('parses 3/4', () => {
    expect(Score.parseTimeSignature('3/4')).toEqual({ beats: 3, noteValue: 'q' })
  })
  it('parses 6/8', () => {
    expect(Score.parseTimeSignature('6/8')).toEqual({ beats: 6, noteValue: 'e' })
  })
  it('parses 2/2', () => {
    expect(Score.parseTimeSignature('2/2')).toEqual({ beats: 2, noteValue: 'h' })
  })
  it('parses 12/8', () => {
    expect(Score.parseTimeSignature('12/8')).toEqual({ beats: 12, noteValue: 'e' })
  })
  it('parses 2/4', () => {
    expect(Score.parseTimeSignature('2/4')).toEqual({ beats: 2, noteValue: 'q' })
  })
  it('throws on invalid format "44"', () => {
    expect(() => Score.parseTimeSignature('44')).toThrow()
  })
  it('throws on unknown denominator "4/3"', () => {
    expect(() => Score.parseTimeSignature('4/3')).toThrow()
  })
  it('throws on invalid numerator "x/4"', () => {
    expect(() => Score.parseTimeSignature('x/4')).toThrow()
  })
})

describe('Score parts management', () => {
  let score: Score

  it('addPart creates and returns a part', () => {
    score = new Score()
    const part = score.addPart('Violin')
    expect(part).toBeDefined()
    expect(part.name).toBe('Violin')
  })

  it('getPart returns the added part', () => {
    score = new Score()
    score.addPart('Violin')
    const part = score.getPart('Violin')
    expect(part).toBeDefined()
    expect(part!.name).toBe('Violin')
  })

  it('getPart returns undefined for unknown part', () => {
    score = new Score()
    expect(score.getPart('NotThere')).toBeUndefined()
  })

  it('getParts returns all parts', () => {
    score = new Score()
    score.addPart('Violin')
    score.addPart('Cello')
    score.addPart('Viola')
    const parts = score.getParts()
    expect(parts).toHaveLength(3)
    expect(parts.map((p) => p.name)).toEqual(['Violin', 'Cello', 'Viola'])
  })

  it('addPart replaces existing part with same name', () => {
    score = new Score()
    score.addPart('Violin')
    score.addPart('Violin') // replaces
    expect(score.getParts()).toHaveLength(1)
  })
})
