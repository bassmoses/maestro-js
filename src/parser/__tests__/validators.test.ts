import { describe, it, expect } from 'vitest'
import { validate } from '../validators.js'
import { parse } from '../parser.js'
import { NoteNode } from '../types.js'

function makeNode(overrides: Partial<NoteNode> = {}): NoteNode {
  const defaults: NoteNode = {
    type: 'note',
    pitch: 'C',
    accidental: null,
    octave: 4,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    isBarline: false,
    chord: false,
    triplet: false,
    fermata: false,
  }
  return { ...defaults, ...overrides }
}

describe('validate — valid nodes', () => {
  it('returns empty array for valid note', () => {
    const errors = validate([makeNode()])
    expect(errors).toHaveLength(0)
  })

  it('returns empty array for a rest node', () => {
    const errors = validate([makeNode({ type: 'rest', pitch: null, octave: null })])
    expect(errors).toHaveLength(0)
  })

  it('returns empty array for barline node', () => {
    const errors = validate([makeNode({ isBarline: true, pitch: null, octave: null })])
    expect(errors).toHaveLength(0)
  })

  it('accepts all valid pitches', () => {
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    for (const p of pitches) {
      const errors = validate([makeNode({ pitch: p })])
      expect(errors).toHaveLength(0)
    }
  })

  it('accepts all valid durations', () => {
    const durations = ['w', 'h', 'q', 'e', 's', 't'] as const
    for (const d of durations) {
      const errors = validate([makeNode({ duration: d })])
      expect(errors).toHaveLength(0)
    }
  })

  it('accepts all octaves 0–8', () => {
    for (let octave = 0; octave <= 8; octave++) {
      const errors = validate([makeNode({ octave: octave as NoteNode['octave'] })])
      expect(errors).toHaveLength(0)
    }
  })

  it('accepts all valid dynamics', () => {
    const dynamics = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'cresc', 'decresc'] as const
    for (const d of dynamics) {
      const errors = validate([makeNode({ dynamic: d })])
      expect(errors).toHaveLength(0)
    }
  })
})

describe('validate — time signature', () => {
  it('validates a correct 4/4 measure', () => {
    const nodes = [
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
    ]
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })

  it('reports error for measure that overflows 4/4', () => {
    const nodes = [
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }), // one too many
    ]
    const errors = validate(nodes, '4/4')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/beat|measure|overflow/i)
  })

  it('validates a correct 3/4 measure', () => {
    const nodes = [
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
    ]
    const errors = validate(nodes, '3/4')
    expect(errors).toHaveLength(0)
  })

  it('validates multiple measures separated by barlines', () => {
    const nodes = [
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ isBarline: true, pitch: null, octave: null }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
      makeNode({ duration: 'q' }),
    ]
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })

  it('does not validate time signature when not provided', () => {
    // 5 quarter notes — would overflow 4/4 but no time sig given
    const nodes = Array.from({ length: 5 }, () => makeNode({ duration: 'q' }))
    const errors = validate(nodes)
    expect(errors).toHaveLength(0)
  })

  it('reports error for invalid time signature string', () => {
    const nodes = [makeNode()]
    const errors = validate(nodes, 'invalid')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/time signature/i)
  })

  it('validates dotted notes correctly in time signature context', () => {
    // dotted half (3 beats) + quarter (1 beat) = 4 beats = correct 4/4
    const nodes = [makeNode({ duration: 'h', dotted: true }), makeNode({ duration: 'q' })]
    const errors = validate(nodes, '4/4')
    expect(errors).toHaveLength(0)
  })
})

describe('validate — chord beat counting', () => {
  it('counts a 4-chord measure as exactly 4 beats in 4/4', () => {
    const errors = validate(parse('[C4 E4 G4]:q [D4 F4 A4]:q [E4 G4 B4]:q [F4 A4 C5]:q'), '4/4')
    expect(errors).toHaveLength(0)
  })
})

describe('validate — triplet beat counting', () => {
  it('counts 4 triplet groups as exactly 4 beats in 4/4', () => {
    const errors = validate(parse('{C4 D4 E4}:q {F4 G4 A4}:q {B4 C5 D5}:q {E5 F5 G5}:q'), '4/4')
    expect(errors).toHaveLength(0)
  })
})

describe('validate — invalid nodes (force invalid states)', () => {
  it('reports error for invalid pitch name', () => {
    // Force an invalid pitch via type casting (simulating corrupted AST)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = makeNode({ pitch: 'H' as any })
    const errors = validate([node])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/valid note name/i)
  })

  it('reports error for invalid duration', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = makeNode({ duration: 'x' as any })
    const errors = validate([node])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/duration/i)
  })

  it('reports error for invalid dynamic', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = makeNode({ dynamic: 'sfz' as any })
    const errors = validate([node])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/dynamic/i)
  })

  it('reports error for octave out of range (negative)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = makeNode({ octave: -1 as any })
    const errors = validate([node])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/octave/i)
  })

  it('reports error for octave out of range (too high)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = makeNode({ octave: 9 as any })
    const errors = validate([node])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/octave/i)
  })

  it('collects multiple errors for multiple bad nodes', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = [makeNode({ pitch: 'H' as any }), makeNode({ duration: 'x' as any })]
    const errors = validate(nodes)
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})
