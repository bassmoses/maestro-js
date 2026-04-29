import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { tokenize } from '../tokenizer.js'
import { validate } from '../validators.js'
import { MaestroError } from '../errors.js'

// ──────────────────────────────────────────────
// Exhaustive pitch coverage: all 12 pitch names
// ──────────────────────────────────────────────
describe('parse — all pitches', () => {
  const naturalPitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

  for (const p of naturalPitches) {
    it(`parses natural pitch ${p}4`, () => {
      const nodes = parse(`${p}4:q`)
      expect(nodes[0].pitch).toBe(p)
      expect(nodes[0].accidental).toBeNull()
    })
  }

  const sharpPitches = ['C#', 'D#', 'F#', 'G#', 'A#'] as const
  for (const sp of sharpPitches) {
    it(`parses sharp pitch ${sp}4`, () => {
      const nodes = parse(`${sp}4:q`)
      expect(nodes[0].pitch).toBe(sp[0])
      expect(nodes[0].accidental).toBe('#')
    })
  }

  const flatPitches = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'] as const
  for (const fp of flatPitches) {
    it(`parses flat pitch ${fp}4`, () => {
      const nodes = parse(`${fp}4:q`)
      expect(nodes[0].pitch).toBe(fp[0])
      expect(nodes[0].accidental).toBe('b')
    })
  }

  // Enharmonic equivalents that are valid but unusual
  it('parses E# (enharmonic F)', () => {
    const nodes = parse('E#4:q')
    expect(nodes[0].pitch).toBe('E')
    expect(nodes[0].accidental).toBe('#')
  })

  it('parses B# (enharmonic C)', () => {
    const nodes = parse('B#4:q')
    expect(nodes[0].pitch).toBe('B')
    expect(nodes[0].accidental).toBe('#')
  })

  it('parses Cb (enharmonic B)', () => {
    const nodes = parse('Cb4:q')
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[0].accidental).toBe('b')
  })

  it('parses Fb (enharmonic E)', () => {
    const nodes = parse('Fb4:q')
    expect(nodes[0].pitch).toBe('F')
    expect(nodes[0].accidental).toBe('b')
  })
})

// ──────────────────────────────────────────────
// Exhaustive octave coverage: 0 through 8
// ──────────────────────────────────────────────
describe('parse — all octaves', () => {
  for (let oct = 0; oct <= 8; oct++) {
    it(`parses C${oct}`, () => {
      const nodes = parse(`C${oct}:q`)
      expect(nodes[0].octave).toBe(oct)
    })
  }
})

// ──────────────────────────────────────────────
// Exhaustive duration coverage
// ──────────────────────────────────────────────
describe('parse — all durations', () => {
  const durations = [
    { char: 'w', name: 'whole' },
    { char: 'h', name: 'half' },
    { char: 'q', name: 'quarter' },
    { char: 'e', name: 'eighth' },
    { char: 's', name: 'sixteenth' },
    { char: 't', name: 'thirty-second' },
  ]

  for (const { char, name } of durations) {
    it(`parses ${name} note (:${char})`, () => {
      const nodes = parse(`C4:${char}`)
      expect(nodes[0].duration).toBe(char)
      expect(nodes[0].dotted).toBe(false)
    })

    it(`parses dotted ${name} note (:${char}.)`, () => {
      const nodes = parse(`C4:${char}.`)
      expect(nodes[0].duration).toBe(char)
      expect(nodes[0].dotted).toBe(true)
    })
  }
})

// ──────────────────────────────────────────────
// Double accidentals
// ──────────────────────────────────────────────
describe('parse — double accidentals', () => {
  it('parses double sharp C##4', () => {
    const nodes = parse('C##4:q')
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[0].accidental).toBe('##')
  })

  it('parses double flat Dbb4', () => {
    const nodes = parse('Dbb4:q')
    expect(nodes[0].pitch).toBe('D')
    expect(nodes[0].accidental).toBe('bb')
  })

  it('parses double sharp with octave and duration', () => {
    const nodes = parse('F##5:h.')
    expect(nodes[0].pitch).toBe('F')
    expect(nodes[0].accidental).toBe('##')
    expect(nodes[0].octave).toBe(5)
    expect(nodes[0].duration).toBe('h')
    expect(nodes[0].dotted).toBe(true)
  })

  it('parses double flat in chord', () => {
    const nodes = parse('[C4 Ebb4 G4]:q')
    expect(nodes[1].accidental).toBe('bb')
    expect(nodes[1].chord).toBe(true)
  })
})

// ──────────────────────────────────────────────
// Rests with all durations
// ──────────────────────────────────────────────
describe('parse — rests', () => {
  const durations = ['w', 'h', 'q', 'e', 's', 't'] as const
  for (const d of durations) {
    it(`parses rest R:${d}`, () => {
      const nodes = parse(`R:${d}`)
      expect(nodes[0].type).toBe('rest')
      expect(nodes[0].pitch).toBeNull()
      expect(nodes[0].octave).toBeNull()
      expect(nodes[0].duration).toBe(d)
    })
  }

  it('parses dotted rest R:h.', () => {
    const nodes = parse('R:h.')
    expect(nodes[0].type).toBe('rest')
    expect(nodes[0].dotted).toBe(true)
  })

  it('rest defaults to quarter when no duration', () => {
    const nodes = parse('R')
    expect(nodes[0].type).toBe('rest')
    expect(nodes[0].duration).toBe('q')
  })
})

// ──────────────────────────────────────────────
// Chord groups
// ──────────────────────────────────────────────
describe('parse — chord groups', () => {
  it('assigns sequential chordGroup IDs', () => {
    const nodes = parse('[C4 E4 G4]:h [D4 F4 A4]:h')
    expect(nodes.slice(0, 3).every((n) => n.chordGroup === 0)).toBe(true)
    expect(nodes.slice(3, 6).every((n) => n.chordGroup === 1)).toBe(true)
  })

  it('three chord groups get IDs 0, 1, 2', () => {
    const nodes = parse('[C4 E4]:q [D4 F4]:q [E4 G4]:q')
    expect(nodes[0].chordGroup).toBe(0)
    expect(nodes[2].chordGroup).toBe(1)
    expect(nodes[4].chordGroup).toBe(2)
  })

  it('non-chord notes have no chordGroup', () => {
    const nodes = parse('C4:q D4:q')
    expect(nodes[0].chordGroup).toBeUndefined()
    expect(nodes[1].chordGroup).toBeUndefined()
  })
})

// ──────────────────────────────────────────────
// Complex sequences
// ──────────────────────────────────────────────
describe('parse — complex sequences', () => {
  it('parses verse melody from plan', () => {
    const nodes = parse('D4:q F#4:q A4:h | A4:q G4:q F#4:h | E4:q F#4:q G4:q F#4:q | D4:w')
    const notes = nodes.filter((n) => !n.isBarline)
    // 3 + 3 + 4 + 1 = 11 notes
    expect(notes).toHaveLength(11)
    expect(notes[0].pitch).toBe('D')
    expect(notes[1].pitch).toBe('F')
    expect(notes[1].accidental).toBe('#')
    expect(notes[10].pitch).toBe('D')
    expect(notes[10].duration).toBe('w')
  })

  it('parses melody with dynamics', () => {
    const nodes = parse('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h')
    const notes = nodes.filter((n) => !n.isBarline)
    expect(notes[0].dynamic).toBe('mp')
    expect(notes[3].dynamic).toBe('mf')
  })

  it('parses chord progression without dynamics', () => {
    const nodes = parse('[D4 F#4 A4]:h [A4 C#5 E5]:h')
    expect(nodes[0].chord).toBe(true)
    expect(nodes.length).toBe(6)
    expect(nodes[0].chordGroup).toBe(0)
    expect(nodes[3].chordGroup).toBe(1)
  })

  it('parses chord with dynamic', () => {
    const nodes = parse('[D4 F#4 A4]:h(f)')
    expect(nodes).toHaveLength(3)
    nodes.forEach((n) => {
      expect(n.chord).toBe(true)
      expect(n.dynamic).toBe('f')
      expect(n.duration).toBe('h')
    })
  })

  it('parses chord with crescendo', () => {
    const nodes = parse('[C4 E4]:q(p<)')
    expect(nodes).toHaveLength(2)
    nodes.forEach((n) => {
      expect(n.dynamic).toBe('cresc')
    })
  })

  it('parses triplet followed by normal notes', () => {
    const nodes = parse('{C4 D4 E4}:q F4:q G4:h')
    expect(nodes).toHaveLength(5)
    expect(nodes[0].triplet).toBe(true)
    expect(nodes[1].triplet).toBe(true)
    expect(nodes[2].triplet).toBe(true)
    expect(nodes[3].triplet).toBe(false)
    expect(nodes[4].triplet).toBe(false)
  })

  it('parses tie across barline', () => {
    const nodes = parse('C4:h~C4:h | C4:q D4:q E4:h')
    expect(nodes[0].tied).toBe(true)
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[1].tied).toBe(false)
    expect(nodes[1].pitch).toBe('C')
    expect(nodes[2].isBarline).toBe(true)
  })

  it('parses slur with mixed durations', () => {
    const nodes = parse('(C4:e D4:e E4:q F4:h)')
    expect(nodes).toHaveLength(4)
    nodes.forEach((n) => expect(n.slurred).toBe(true))
    expect(nodes[0].duration).toBe('e')
    expect(nodes[3].duration).toBe('h')
  })

  it('parses note then chord then triplet then rest', () => {
    const nodes = parse('C4:q [E4 G4]:q {A4 B4 C5}:q R:q')
    expect(nodes).toHaveLength(7) // 1 note + 2 chord + 3 triplet + 1 rest
    expect(nodes[0].chord).toBe(false)
    expect(nodes[1].chord).toBe(true)
    expect(nodes[2].chord).toBe(true)
    expect(nodes[3].triplet).toBe(true)
    expect(nodes[6].type).toBe('rest')
  })
})

// ──────────────────────────────────────────────
// Error messages with suggestions
// ──────────────────────────────────────────────
describe('tokenize — error messages with suggestions', () => {
  it('suggests A for H (German notation)', () => {
    try {
      tokenize('H4:q')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(MaestroError)
      const err = e as MaestroError
      expect(err.suggestion).toContain('Did you mean')
      expect(err.suggestion).toContain('A')
    }
  })

  it('format() includes suggestion text', () => {
    try {
      tokenize('H4:q')
      expect.fail('should have thrown')
    } catch (e) {
      const formatted = (e as MaestroError).format()
      expect(formatted).toContain('Did you mean')
      expect(formatted).toContain('A4:q')
    }
  })

  it('format() includes position arrows for unknown pitch', () => {
    try {
      tokenize('C4:q H4:q')
      expect.fail('should have thrown')
    } catch (e) {
      const formatted = (e as MaestroError).format()
      expect(formatted).toContain('^')
      expect(formatted).toContain('Input:')
    }
  })

  it('throws for lowercase note names', () => {
    expect(() => tokenize('c4:q')).toThrow(MaestroError)
  })

  it('throws for unknown characters with position', () => {
    try {
      tokenize('C4:q @ D4:q')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(MaestroError)
      const err = e as MaestroError
      expect(err.position).toBe(5)
      expect(err.length).toBe(1)
    }
  })
})

// ──────────────────────────────────────────────
// Validator — time signature enforcement
// ──────────────────────────────────────────────
describe('validate — chord group beat counting', () => {
  it('two half-note chords fill exactly 4/4', () => {
    const nodes = parse('[C4 E4 G4]:h [D4 F4 A4]:h')
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })

  it('three quarter-note chords overflow 2/4', () => {
    const nodes = parse('[C4 E4]:q [D4 F4]:q [E4 G4]:q')
    const errors = validate(nodes, '2/4')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/overflow/i)
    expect(errors[0].measure).toBe(1)
  })

  it('mixed chord and single notes count correctly', () => {
    const nodes = parse('[C4 E4]:h D4:q E4:q')
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })
})

describe('validate — various time signatures', () => {
  it('validates 6/8 (6 eighth-note beats = 3 quarter beats)', () => {
    const nodes = parse('C4:e D4:e E4:e F4:e G4:e A4:e')
    const errors = validate(nodes, '6/8')
    expect(errors).toHaveLength(0)
  })

  it('validates 2/4 correctly', () => {
    const nodes = parse('C4:q D4:q')
    const errors = validate(nodes, '2/4')
    expect(errors).toHaveLength(0)
  })

  it('validates 3/4 with dotted half (fills whole measure)', () => {
    const nodes = parse('C4:h.')
    const errors = validate(nodes, '3/4')
    expect(errors).toHaveLength(0)
  })

  it('overflow error includes measure number', () => {
    const nodes = parse('C4:q D4:q | E4:q F4:q G4:q')
    const errors = validate(nodes, '2/4')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].measure).toBe(2)
  })

  it('underfilled measure is a warning, not an error', () => {
    // Only 2 beats in 4/4 — valid but produces a warning
    const nodes = parse('C4:q D4:q')
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(1)
    expect(errors[0].severity).toBe('warning')
    expect(errors[0].message).toContain('underfilled')
  })

  it('triplet group counts correct beats in time signature', () => {
    // Triplet quarter = 1 beat in 4/4, plus 3 regular quarters = 4 beats total
    const nodes = parse('{C4 D4 E4}:q F4:q G4:q A4:q')
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────
// MaestroError.format() enhanced
// ──────────────────────────────────────────────
describe('MaestroError — enhanced format', () => {
  it('format includes suggestion when provided', () => {
    const err = new MaestroError('Bad note', 'H4:q', 0, 4, 'Did you mean: A4:q?')
    const formatted = err.format()
    expect(formatted).toContain('Did you mean: A4:q?')
  })

  it('format works without suggestion', () => {
    const err = new MaestroError('Bad char', 'C4:q @', 5, 1)
    const formatted = err.format()
    expect(formatted).not.toContain('Did you mean')
    expect(formatted).toContain('^')
  })
})

// ──────────────────────────────────────────────
// suggestPitch
// ──────────────────────────────────────────────
describe('suggestPitch', () => {
  // Import directly
  it('is accessible via MaestroError import path', async () => {
    const { suggestPitch } = await import('../errors.js')
    expect(suggestPitch('H')).toBe('A')
    expect(suggestPitch('I')).toBe('A')
    expect(suggestPitch('J')).toBe('G')
  })
})
