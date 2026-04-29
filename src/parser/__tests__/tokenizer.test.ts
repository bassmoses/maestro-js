import { describe, it, expect } from 'vitest'
import { tokenize } from '../tokenizer.js'
import { MaestroError } from '../errors.js'

describe('tokenize — basic notes', () => {
  it('tokenizes a single quarter note', () => {
    const tokens = tokenize('C4:q')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('C4:q')
    expect(tokens[0].position).toBe(0)
  })

  it('tokenizes a note with accidental', () => {
    const tokens = tokenize('D#5:h')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('D#5:h')
  })

  it('tokenizes a flat note', () => {
    const tokens = tokenize('Bb3:e')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('Bb3:e')
  })

  it('tokenizes a dotted note', () => {
    const tokens = tokenize('G4:h.')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('G4:h.')
  })

  it('tokenizes a rest', () => {
    const tokens = tokenize('R:q')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('R:q')
  })

  it('tokenizes multiple notes', () => {
    const tokens = tokenize('C4:q D4:q E4:h')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].raw).toBe('C4:q')
    expect(tokens[1].raw).toBe('D4:q')
    expect(tokens[2].raw).toBe('E4:h')
  })

  it('tokenizes notes without duration (default)', () => {
    const tokens = tokenize('C4 D4 E4')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('C4')
  })

  it('tracks position correctly', () => {
    const tokens = tokenize('C4:q D4:q')
    expect(tokens[0].position).toBe(0)
    expect(tokens[1].position).toBe(5)
  })
})

describe('tokenize — note with dynamic', () => {
  it('includes dynamic in NOTE raw string', () => {
    const tokens = tokenize('C4:q(mp)')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('C4:q(mp)')
  })

  it('includes crescendo in NOTE raw string', () => {
    const tokens = tokenize('C4:q(p<)')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].raw).toBe('C4:q(p<)')
  })

  it('includes ff dynamic in NOTE raw string', () => {
    const tokens = tokenize('G4:h(ff)')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].raw).toBe('G4:h(ff)')
  })
})

describe('tokenize — barlines', () => {
  it('tokenizes a barline', () => {
    const tokens = tokenize('|')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('BARLINE')
    expect(tokens[0].raw).toBe('|')
  })

  it('tokenizes notes with barlines', () => {
    const tokens = tokenize('C4:q D4:q | E4:q')
    expect(tokens).toHaveLength(4)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[1].type).toBe('NOTE')
    expect(tokens[2].type).toBe('BARLINE')
    expect(tokens[3].type).toBe('NOTE')
  })
})

describe('tokenize — ties', () => {
  it('tokenizes tied notes as separate NOTE tokens with TIE connector', () => {
    const tokens = tokenize('C4:h~C4:h')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[0].raw).toBe('C4:h')
    expect(tokens[1].type).toBe('TIE')
    expect(tokens[1].raw).toBe('~')
    expect(tokens[2].type).toBe('NOTE')
    expect(tokens[2].raw).toBe('C4:h')
  })
})

describe('tokenize — chords', () => {
  it('tokenizes a chord as a single CHORD token', () => {
    const tokens = tokenize('[C4 E4 G4]:h')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('CHORD')
    expect(tokens[0].raw).toBe('[C4 E4 G4]:h')
  })
})

describe('tokenize — triplets', () => {
  it('tokenizes a triplet as a single TRIPLET token', () => {
    const tokens = tokenize('{C4 D4 E4}:q')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('TRIPLET')
    expect(tokens[0].raw).toBe('{C4 D4 E4}:q')
  })
})

describe('tokenize — slurs', () => {
  it('tokenizes a slur as a single SLUR token', () => {
    const tokens = tokenize('(E4:q F4:q G4:h)')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('SLUR')
    expect(tokens[0].raw).toBe('(E4:q F4:q G4:h)')
  })

  it('does NOT treat note with inline dynamic as slur', () => {
    const tokens = tokenize('C4:q(mp) D4:q')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[1].type).toBe('NOTE')
  })
})

describe('tokenize — complex sequences', () => {
  it('tokenizes mixed sequence', () => {
    const tokens = tokenize('C4:q [C4 E4 G4]:h | R:q')
    expect(tokens).toHaveLength(4)
    expect(tokens[0].type).toBe('NOTE')
    expect(tokens[1].type).toBe('CHORD')
    expect(tokens[2].type).toBe('BARLINE')
    expect(tokens[3].type).toBe('NOTE')
  })
})

describe('tokenize — error cases', () => {
  it('throws MaestroError for unclosed chord bracket', () => {
    expect(() => tokenize('[C4 E4')).toThrow(MaestroError)
  })

  it('throws MaestroError for unclosed triplet bracket', () => {
    expect(() => tokenize('{C4 D4')).toThrow(MaestroError)
  })

  it('throws MaestroError for unclosed slur', () => {
    expect(() => tokenize('(E4:q F4:q')).toThrow(MaestroError)
  })

  it('throws MaestroError for unexpected character', () => {
    expect(() => tokenize('C4:q @ D4:q')).toThrow(MaestroError)
  })

  it('tokenizes chord without duration after bracket', () => {
    // [C4 E4] with no :duration — raw ends at ]
    const tokens = tokenize('[C4 E4]')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('CHORD')
    expect(tokens[0].raw).toBe('[C4 E4]')
  })
})
