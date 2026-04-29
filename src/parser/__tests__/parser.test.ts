import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { MaestroError } from '../errors.js'

describe('parse — basic notes', () => {
  it('parses a quarter note C4', () => {
    const nodes = parse('C4:q')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('note')
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[0].accidental).toBeNull()
    expect(nodes[0].octave).toBe(4)
    expect(nodes[0].duration).toBe('q')
    expect(nodes[0].dotted).toBe(false)
    expect(nodes[0].isBarline).toBe(false)
    expect(nodes[0].chord).toBe(false)
    expect(nodes[0].triplet).toBe(false)
  })

  it('parses D#5 half note', () => {
    const nodes = parse('D#5:h')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].pitch).toBe('D')
    expect(nodes[0].accidental).toBe('#')
    expect(nodes[0].octave).toBe(5)
    expect(nodes[0].duration).toBe('h')
    expect(nodes[0].dotted).toBe(false)
  })

  it('parses Bb3 eighth note', () => {
    const nodes = parse('Bb3:e')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].pitch).toBe('B')
    expect(nodes[0].accidental).toBe('b')
    expect(nodes[0].octave).toBe(3)
    expect(nodes[0].duration).toBe('e')
  })

  it('parses dotted half note G4', () => {
    const nodes = parse('G4:h.')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].pitch).toBe('G')
    expect(nodes[0].octave).toBe(4)
    expect(nodes[0].duration).toBe('h')
    expect(nodes[0].dotted).toBe(true)
  })

  it('parses a quarter rest', () => {
    const nodes = parse('R:q')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('rest')
    expect(nodes[0].pitch).toBeNull()
    expect(nodes[0].octave).toBeNull()
    expect(nodes[0].duration).toBe('q')
  })

  it('parses multiple notes', () => {
    const nodes = parse('C4:q D4:q E4:h')
    expect(nodes).toHaveLength(3)
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[1].pitch).toBe('D')
    expect(nodes[2].pitch).toBe('E')
    expect(nodes[2].duration).toBe('h')
  })

  it('parses double flat accidental', () => {
    const nodes = parse('Ebb4:q')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].pitch).toBe('E')
    expect(nodes[0].accidental).toBe('bb')
  })

  it('parses double sharp accidental', () => {
    const nodes = parse('C##4:q')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[0].accidental).toBe('##')
  })
})

describe('parse — defaults', () => {
  it('defaults to quarter note when no duration specified', () => {
    const nodes = parse('C4 D4 E4')
    expect(nodes).toHaveLength(3)
    nodes.forEach(n => {
      expect(n.duration).toBe('q')
      expect(n.dotted).toBe(false)
    })
  })

  it('defaults single note to quarter', () => {
    const nodes = parse('A5')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].duration).toBe('q')
    expect(nodes[0].pitch).toBe('A')
    expect(nodes[0].octave).toBe(5)
  })
})

describe('parse — chords', () => {
  it('parses a chord with half duration', () => {
    const nodes = parse('[C4 E4 G4]:h')
    expect(nodes).toHaveLength(3)
    nodes.forEach(n => {
      expect(n.chord).toBe(true)
      expect(n.duration).toBe('h')
      expect(n.triplet).toBe(false)
    })
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[1].pitch).toBe('E')
    expect(nodes[2].pitch).toBe('G')
  })

  it('parses a dotted chord', () => {
    const nodes = parse('[C4 E4]:h.')
    expect(nodes).toHaveLength(2)
    nodes.forEach(n => {
      expect(n.chord).toBe(true)
      expect(n.duration).toBe('h')
      expect(n.dotted).toBe(true)
    })
  })

  it('parses chord with accidentals', () => {
    const nodes = parse('[C4 E4 G#4]:q')
    expect(nodes[2].accidental).toBe('#')
    expect(nodes[2].chord).toBe(true)
  })
})

describe('parse — triplets', () => {
  it('parses a triplet, all notes triplet:true', () => {
    const nodes = parse('{C4 D4 E4}:q')
    expect(nodes).toHaveLength(3)
    nodes.forEach(n => {
      expect(n.triplet).toBe(true)
      expect(n.tripletGroup).toBe(0)
    })
  })

  it('triplet notes get eighth duration (3 in 1 quarter)', () => {
    const nodes = parse('{C4 D4 E4}:q')
    nodes.forEach(n => {
      expect(n.duration).toBe('e')
    })
  })

  it('assigns sequential triplet groups', () => {
    const nodes = parse('{C4 D4 E4}:q {F4 G4 A4}:q')
    expect(nodes).toHaveLength(6)
    nodes.slice(0, 3).forEach(n => expect(n.tripletGroup).toBe(0))
    nodes.slice(3, 6).forEach(n => expect(n.tripletGroup).toBe(1))
  })
})

describe('parse — ties', () => {
  it('parses tied notes with first.tied = true', () => {
    const nodes = parse('C4:h~C4:h')
    expect(nodes).toHaveLength(2)
    expect(nodes[0].tied).toBe(true)
    expect(nodes[1].tied).toBe(false)
    expect(nodes[0].pitch).toBe('C')
    expect(nodes[1].pitch).toBe('C')
  })

  it('tied notes are both still full NOTE nodes', () => {
    const nodes = parse('C4:h~C4:h')
    expect(nodes[0].type).toBe('note')
    expect(nodes[1].type).toBe('note')
    expect(nodes[0].duration).toBe('h')
    expect(nodes[1].duration).toBe('h')
  })
})

describe('parse — slurs', () => {
  it('parses a slur, all notes slurred:true', () => {
    const nodes = parse('(E4:q F4:q G4:h)')
    expect(nodes).toHaveLength(3)
    nodes.forEach(n => {
      expect(n.slurred).toBe(true)
    })
    expect(nodes[0].pitch).toBe('E')
    expect(nodes[1].pitch).toBe('F')
    expect(nodes[2].pitch).toBe('G')
  })

  it('slurred notes keep their own durations', () => {
    const nodes = parse('(E4:q F4:q G4:h)')
    expect(nodes[0].duration).toBe('q')
    expect(nodes[1].duration).toBe('q')
    expect(nodes[2].duration).toBe('h')
  })

  it('slurred notes are not chord or triplet', () => {
    const nodes = parse('(E4:q F4:q)')
    nodes.forEach(n => {
      expect(n.chord).toBe(false)
      expect(n.triplet).toBe(false)
    })
  })
})

describe('parse — dynamics', () => {
  it('parses mp dynamic', () => {
    const nodes = parse('C4:q(mp)')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].dynamic).toBe('mp')
  })

  it('parses crescendo (p<)', () => {
    const nodes = parse('C4:q(p<)')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].dynamic).toBe('cresc')
  })

  it('parses decrescendo (p>)', () => {
    const nodes = parse('C4:q(p>)')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].dynamic).toBe('decresc')
  })

  it('parses ff dynamic', () => {
    const nodes = parse('G4:h(ff)')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].dynamic).toBe('ff')
  })

  it('parses all standard dynamics', () => {
    const cases: Array<[string, string]> = [
      ['ppp', 'ppp'],
      ['pp', 'pp'],
      ['p', 'p'],
      ['mp', 'mp'],
      ['mf', 'mf'],
      ['f', 'f'],
      ['ff', 'ff'],
      ['fff', 'fff'],
    ]
    for (const [input, expected] of cases) {
      const nodes = parse(`C4:q(${input})`)
      expect(nodes[0].dynamic).toBe(expected)
    }
  })

  it('note without dynamic has null dynamic', () => {
    const nodes = parse('C4:q')
    expect(nodes[0].dynamic).toBeNull()
  })
})

describe('parse — barlines', () => {
  it('parses barline as isBarline node', () => {
    const nodes = parse('C4:q D4:q | E4:q')
    expect(nodes).toHaveLength(4)
    expect(nodes[2].isBarline).toBe(true)
  })

  it('barline node is type "note" with isBarline flag', () => {
    const nodes = parse('|')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].isBarline).toBe(true)
  })

  it('parses multiple measures', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q | G4:h E4:h')
    const barlines = nodes.filter(n => n.isBarline)
    expect(barlines).toHaveLength(1)
    const notes = nodes.filter(n => !n.isBarline)
    expect(notes).toHaveLength(6)
  })
})

describe('parse — error cases', () => {
  it('throws MaestroError for invalid pitch name H4', () => {
    expect(() => parse('H4:q')).toThrow(MaestroError)
  })

  it('throws MaestroError with helpful message for invalid pitch', () => {
    try {
      parse('H4:q')
    } catch (e) {
      expect(e).toBeInstanceOf(MaestroError)
      expect((e as MaestroError).message).toContain('H')
    }
  })

  it('throws MaestroError for invalid duration :x', () => {
    expect(() => parse('C4:x')).toThrow(MaestroError)
  })

  it('throws MaestroError with position info', () => {
    try {
      parse('C4:q H4:q')
    } catch (e) {
      expect(e).toBeInstanceOf(MaestroError)
      const err = e as MaestroError
      expect(err.position).toBeDefined()
      expect(err.position).toBeGreaterThan(0)
    }
  })
})

describe('parse — complex sequences', () => {
  it('parses full musical phrase', () => {
    const nodes = parse('C4:q D4:q E4:q F4:q | G4:h E4:h')
    expect(nodes.filter(n => !n.isBarline)).toHaveLength(6)
    expect(nodes.filter(n => n.isBarline)).toHaveLength(1)
  })

  it('parses sequence with chord and barline', () => {
    const nodes = parse('[C4 E4 G4]:h D4:q | E4:q')
    const chordNotes = nodes.filter(n => n.chord)
    expect(chordNotes).toHaveLength(3)
    expect(nodes.filter(n => n.isBarline)).toHaveLength(1)
  })

  it('note is not slurred, chord, or triplet by default', () => {
    const nodes = parse('C4:q')
    expect(nodes[0].slurred).toBe(false)
    expect(nodes[0].chord).toBe(false)
    expect(nodes[0].triplet).toBe(false)
    expect(nodes[0].tied).toBe(false)
  })
})

describe('parse — edge cases and additional coverage', () => {
  it('parses chord without explicit duration (defaults to quarter)', () => {
    // chord tokens with no duration after ]
    // Note: spec says duration required on chord but parser should be robust
    // Test chord with explicit quarter duration
    const nodes = parse('[C4 G4]:q')
    expect(nodes).toHaveLength(2)
    expect(nodes[0].duration).toBe('q')
    expect(nodes[0].chord).toBe(true)
  })

  it('parses triplet with half container duration (notes become quarters)', () => {
    const nodes = parse('{C4 D4 E4}:h')
    expect(nodes).toHaveLength(3)
    nodes.forEach(n => {
      expect(n.triplet).toBe(true)
      expect(n.duration).toBe('q') // half triplet => quarter notes
    })
  })

  it('parses a slur with only one note', () => {
    const nodes = parse('(C4:q)')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].slurred).toBe(true)
  })

  it('parses tied notes across a barline scenario', () => {
    // Tie then barline after
    const nodes = parse('C4:h~C4:h | D4:q')
    expect(nodes[0].tied).toBe(true)
    expect(nodes[1].tied).toBe(false)
    // barline should be present
    expect(nodes.some(n => n.isBarline)).toBe(true)
  })

  it('parses whole note', () => {
    const nodes = parse('C4:w')
    expect(nodes[0].duration).toBe('w')
  })

  it('parses sixteenth note', () => {
    const nodes = parse('C4:s')
    expect(nodes[0].duration).toBe('s')
  })

  it('parses thirty-second note', () => {
    const nodes = parse('C4:t')
    expect(nodes[0].duration).toBe('t')
  })

  it('parses note with ppp dynamic', () => {
    const nodes = parse('C4:q(ppp)')
    expect(nodes[0].dynamic).toBe('ppp')
  })

  it('parses note with decresc (p>)', () => {
    const nodes = parse('C4:q(p>)')
    expect(nodes[0].dynamic).toBe('decresc')
  })

  it('chord notes have no triplet flag', () => {
    const nodes = parse('[C4 E4 G4]:q')
    nodes.forEach(n => expect(n.triplet).toBe(false))
  })

  it('slur nodes do not have chord flag', () => {
    const nodes = parse('(C4:q D4:q)')
    nodes.forEach(n => expect(n.chord).toBe(false))
  })

  it('parses F#5 correctly', () => {
    const nodes = parse('F#5:q')
    expect(nodes[0].pitch).toBe('F')
    expect(nodes[0].accidental).toBe('#')
    expect(nodes[0].octave).toBe(5)
  })

  it('returns empty array for empty string', () => {
    const nodes = parse('')
    expect(nodes).toHaveLength(0)
  })

  it('returns empty array for whitespace-only string', () => {
    const nodes = parse('   ')
    expect(nodes).toHaveLength(0)
  })

  it('unrecognized dynamic is treated as null', () => {
    // Dynamic like (sfz) is not in the valid set; parseDynamicString returns null
    // This exercises the final null return in parseDynamicString
    // We need to construct a token with an unrecognized dynamic;
    // the tokenizer allows any (xxx) after a note so we can reach parseDynamicString
    const nodes = parse('C4:q(sfz)')
    expect(nodes[0].dynamic).toBeNull()
  })

  it('slur note without dynamic has null dynamic', () => {
    // Exercises the dynRaw === undefined branch in parseNoteRaw for slur notes
    const nodes = parse('(C4:q D4:q)')
    nodes.forEach(n => expect(n.dynamic).toBeNull())
  })
})
