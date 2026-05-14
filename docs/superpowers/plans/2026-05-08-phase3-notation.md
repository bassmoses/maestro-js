# Phase 3: Notation Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add percussion notation, tablature rendering, chord grid view, and ARIA accessibility to maestro-js.

**Architecture:** Each feature is a vertical slice: percussion extends the type system (NoteData), parser, renderer, and audio/MIDI adapters together; tablature adds a new render mode on `VoiceModel` and a new `TabRenderer` helper used by `VexFlowAdapter`; chord grid is a standalone pure-SVG renderer exposed as `Song.renderChordGrid()` — it never touches VexFlow; ARIA labels are a post-render DOM pass added to `VexFlowAdapter.render()`.

**Tech Stack:** TypeScript, VexFlow 5, jsdom (tests)

---

## File Map

| Action | File |
|--------|------|
| Create | `src/model/percussion.ts` — `PercussionInstrument` type + `GM_DRUM_MAP` constant |
| Modify | `src/model/types.ts` — add `percussion` field to `NoteData` |
| Modify | `src/model/Note.ts` — expose `isPercussion` getter and `percussionMidi` getter |
| Modify | `src/model/VoiceModel.ts` — add `'percussion'` and `'tab'` to `Clef` union |
| Modify | `src/model/converter.ts` — map `NoteNode.percussion` to `NoteData.percussion` |
| Modify | `src/parser/types.ts` — add `PERCUSSION` token type, `percussion` field to `NoteNode` |
| Modify | `src/parser/tokenizer.ts` — tokenize `X<DRUM>:dur` syntax |
| Modify | `src/parser/parser.ts` — parse percussion note node |
| Modify | `src/adapters/renderer/render-note.ts` — handle `isPercussion` in `noteToVexKey` |
| Modify | `src/adapters/renderer/modifiers.ts` — use `NoteheadType.X` for percussion notes |
| Modify | `src/adapters/renderer/VexFlowAdapter.ts` — percussion clef pass-through; tab stave rendering; ARIA post-pass |
| Modify | `src/adapters/renderer/types.ts` — add `ariaLabel` option |
| Modify | `src/adapters/export/MIDIAdapter.ts` — route percussion notes to channel 10 |
| Modify | `src/adapters/audio/SoundfontAdapter.ts` — guard percussion notes to avoid crash |
| Create | `src/adapters/renderer/TabRenderer.ts` — pitch-to-fret algorithm + VexFlow TabStave/TabNote builder |
| Create | `src/adapters/renderer/ChordGridRenderer.ts` — pure-SVG chord grid |
| Modify | `src/api/Song.ts` — add `Song.renderChordGrid()` + `ariaLabel` option |
| Modify | `src/index.ts` — export new public types/functions |
| Create | `src/model/__tests__/percussion.test.ts` |
| Create | `src/parser/__tests__/percussion.test.ts` |
| Create | `src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts` |
| Create | `src/adapters/renderer/__tests__/TabRenderer.test.ts` |
| Create | `src/adapters/renderer/__tests__/ChordGridRenderer.test.ts` |
| Create | `src/api/__tests__/Song.chordgrid.test.ts` |
| Create | `src/api/__tests__/Song.aria.test.ts` |

---

## Task 1: Percussion model — `PercussionInstrument` type + GM drum map

**Files:**
- Create: `src/model/percussion.ts`
- Modify: `src/model/types.ts`
- Modify: `src/model/Note.ts`
- Create: `src/model/__tests__/percussion.test.ts`

### What this task does

Adds a `PercussionInstrument` string union (the named drums: `'KICK'`, `'SNARE'`, etc.), a GM drum map that maps each name to a MIDI note number on channel 10, and extends `NoteData` / `Note` to carry a `percussion` field. This is the foundational data layer all other percussion tasks build on.

- [ ] **Step 1.1: Write failing tests**

Create `src/model/__tests__/percussion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { GM_DRUM_MAP, PERCUSSION_INSTRUMENTS } from '../percussion.js'
import { Note } from '../Note.js'
import type { NoteData } from '../types.js'

describe('GM_DRUM_MAP', () => {
  it('maps KICK to MIDI 36', () => {
    expect(GM_DRUM_MAP['KICK']).toBe(36)
  })
  it('maps SNARE to MIDI 38', () => {
    expect(GM_DRUM_MAP['SNARE']).toBe(38)
  })
  it('maps HIHAT to MIDI 42', () => {
    expect(GM_DRUM_MAP['HIHAT']).toBe(42)
  })
  it('maps HIHAT_OPEN to MIDI 46', () => {
    expect(GM_DRUM_MAP['HIHAT_OPEN']).toBe(46)
  })
  it('maps CRASH to MIDI 49', () => {
    expect(GM_DRUM_MAP['CRASH']).toBe(49)
  })
  it('maps RIDE to MIDI 51', () => {
    expect(GM_DRUM_MAP['RIDE']).toBe(51)
  })
  it('maps TOM_HIGH to MIDI 50', () => {
    expect(GM_DRUM_MAP['TOM_HIGH']).toBe(50)
  })
  it('maps TOM_MID to MIDI 47', () => {
    expect(GM_DRUM_MAP['TOM_MID']).toBe(47)
  })
  it('maps TOM_LOW to MIDI 45', () => {
    expect(GM_DRUM_MAP['TOM_LOW']).toBe(45)
  })
  it('PERCUSSION_INSTRUMENTS includes all keys', () => {
    expect(PERCUSSION_INSTRUMENTS).toContain('KICK')
    expect(PERCUSSION_INSTRUMENTS).toContain('SNARE')
    expect(PERCUSSION_INSTRUMENTS).toContain('HIHAT')
  })
})

describe('Note with percussion field', () => {
  it('isPercussion is true when percussion is set', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false, percussion: 'SNARE',
    }
    const note = new Note(data)
    expect(note.isPercussion).toBe(true)
  })
  it('isPercussion is false for ordinary notes', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false,
    }
    const note = new Note(data)
    expect(note.isPercussion).toBe(false)
  })
  it('percussionMidi returns correct MIDI number for KICK', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false, percussion: 'KICK',
    }
    const note = new Note(data)
    expect(note.percussionMidi).toBe(36)
  })
  it('percussionMidi returns null for non-percussion note', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false,
    }
    const note = new Note(data)
    expect(note.percussionMidi).toBeNull()
  })
})
```

- [ ] **Step 1.2: Run tests, verify they fail**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 1.3: Create `src/model/percussion.ts`**

```typescript
export const PERCUSSION_INSTRUMENTS = [
  'KICK', 'SNARE', 'HIHAT', 'HIHAT_OPEN',
  'CRASH', 'RIDE', 'TOM_HIGH', 'TOM_MID', 'TOM_LOW',
] as const

export type PercussionInstrument = typeof PERCUSSION_INSTRUMENTS[number]

/** Standard GM drum map: instrument name -> MIDI note number (channel 10). */
export const GM_DRUM_MAP: Record<PercussionInstrument, number> = {
  KICK:       36,
  SNARE:      38,
  HIHAT:      42,
  HIHAT_OPEN: 46,
  CRASH:      49,
  RIDE:       51,
  TOM_HIGH:   50,
  TOM_MID:    47,
  TOM_LOW:    45,
}
```

- [ ] **Step 1.4: Modify `src/model/types.ts`**

Add import at the top (after the existing imports):

```typescript
import type { PercussionInstrument } from './percussion.js'
```

Add to the `NoteData` interface (after `multiMeasureRest`):

```typescript
  percussion?: PercussionInstrument  // set for unpitched percussion notes
```

- [ ] **Step 1.5: Modify `src/model/Note.ts`**

Add import after the existing imports:

```typescript
import { GM_DRUM_MAP } from './percussion.js'
import type { PercussionInstrument } from './percussion.js'
```

Add `readonly percussion` field to the class (after `multiMeasureRest`):

```typescript
  readonly percussion: PercussionInstrument | undefined
```

Add to the constructor body (after `this.multiMeasureRest = data.multiMeasureRest`):

```typescript
    this.percussion = data.percussion ?? undefined
```

Add getters after `get frequency()`:

```typescript
  get isPercussion(): boolean {
    return this.percussion !== undefined
  }

  get percussionMidi(): number | null {
    if (!this.percussion) return null
    return GM_DRUM_MAP[this.percussion] ?? null
  }
```

- [ ] **Step 1.6: Run tests, verify pass**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 1.7: Commit**

```
git add src/model/percussion.ts src/model/types.ts src/model/Note.ts src/model/__tests__/percussion.test.ts
git commit -m "feat(model): add PercussionInstrument type, GM drum map, and Note.isPercussion/percussionMidi"
```

---

## Task 2: Parser — tokenize and parse `X<DRUM>:dur` percussion syntax

**Files:**
- Modify: `src/parser/types.ts`
- Modify: `src/parser/tokenizer.ts`
- Modify: `src/parser/parser.ts`
- Create: `src/parser/__tests__/percussion.test.ts`

### What this task does

Introduces `X<SNARE>:q` syntax for percussion notes. `X` signals an unpitched/x-notehead note; the drum name inside `<...>` maps to a `PercussionInstrument`. The tokenizer recognizes the pattern before the existing NOTE pattern, producing a token of the new `PERCUSSION` type. The parser converts it to a `NoteNode` with `percussion` set.

- [ ] **Step 2.1: Write failing tests**

Create `src/parser/__tests__/percussion.test.ts`:

```typescript
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
    expect(tokens.every(t => t.type === 'PERCUSSION')).toBe(true)
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
    const nodes = parse('X<KICK>:q X<SNARE>:q X<KICK>:q X<SNARE>:q | X<KICK>:q X<SNARE>:q X<KICK>:q X<SNARE>:q')
    const notes = nodes.filter(n => !n.isBarline)
    expect(notes).toHaveLength(8)
    expect(notes.every(n => n.percussion !== undefined)).toBe(true)
  })
  it('parses dynamic on percussion note', () => {
    const nodes = parse('X<SNARE>:q(f)')
    expect(nodes[0].percussion).toBe('SNARE')
    expect(nodes[0].dynamic).toBe('f')
  })
})
```

- [ ] **Step 2.2: Run tests, verify they fail**

```
npx vitest run src/parser/__tests__/percussion.test.ts
```

- [ ] **Step 2.3: Modify `src/parser/types.ts`**

Add `'PERCUSSION'` to `TokenType` (append to the union):

```typescript
  | 'PERCUSSION'
```

Add `percussion` field to `NoteNode` (after `expression`):

```typescript
  percussion?: import('../model/percussion.js').PercussionInstrument
```

- [ ] **Step 2.4: Modify `src/parser/tokenizer.ts`**

Add import at the very top of the file:

```typescript
import { PERCUSSION_INSTRUMENTS } from '../model/percussion.js'
```

In the `tokenize` function, add the following block **before** the `// Note or Rest:` branch (the `if (/[A-GR]/.test(input[i]))` block):

```typescript
    // Percussion note: X<DRUMNAME>:dur[.][(<dynamic>)]
    if (input[i] === 'X' && input[i + 1] === '<') {
      const start = i
      const closeAngle = input.indexOf('>', i + 2)
      if (closeAngle === -1) {
        throw new MaestroError('Unclosed percussion instrument "<".', input, i, 2)
      }
      const drumName = input.slice(i + 2, closeAngle)
      if (!(PERCUSSION_INSTRUMENTS as readonly string[]).includes(drumName)) {
        throw new MaestroError(
          `Unknown percussion instrument "${drumName}". Valid: ${PERCUSSION_INSTRUMENTS.join(', ')}`,
          input, i, closeAngle - i + 1
        )
      }
      let j = closeAngle + 1
      // Optional :duration[.]
      if (input[j] === ':' && j + 1 < input.length && /[whqest]/.test(input[j + 1])) {
        j += 2
        if (j < input.length && input[j] === '.') j++
      }
      // Optional dynamic: (mp), (f), etc.
      if (j < input.length && input[j] === '(') {
        const dynEnd = input.indexOf(')', j)
        if (dynEnd !== -1) j = dynEnd + 1
      }
      const raw = input.slice(start, j)
      tokens.push({ type: 'PERCUSSION', raw, position: start })
      i = j
      continue
    }
```

- [ ] **Step 2.5: Modify `src/parser/parser.ts`**

Add import at the top (after the existing imports):

```typescript
import type { PercussionInstrument } from '../model/percussion.js'
```

Add `parsePercussionToken` function before the `parse` function:

```typescript
function parsePercussionToken(token: Token, input: string): NoteNode {
  // raw looks like: X<SNARE>:q or X<KICK>:e.  or X<HIHAT> or X<SNARE>:q(f)
  const match = token.raw.match(/^X<([^>]+)>(?::([whqest])(\.)?)?(?:\(([^)]+)\))?/)
  if (!match) {
    throw new MaestroError(`Invalid percussion syntax: "${token.raw}"`, input, token.position, token.raw.length)
  }
  const [, drumName, durRaw, dotRaw, dynRaw] = match
  const duration: DurationName = (durRaw ?? 'q') as DurationName
  const dotted = dotRaw === '.'
  const dynamic: Dynamic | null = dynRaw ? parseDynamicString(dynRaw) : null

  return {
    type: 'note',
    pitch: null,
    accidental: null,
    octave: null,
    duration,
    dotted,
    dynamic,
    tied: false,
    slurred: false,
    isBarline: false,
    chord: false,
    triplet: false,
    fermata: false,
    percussion: drumName as PercussionInstrument,
  }
}
```

Add a `case 'PERCUSSION':` in the `switch (token.type)` block inside `parse`:

```typescript
      case 'PERCUSSION': {
        const node = parsePercussionToken(token, input)
        if (pendingChordSymbol) {
          node.chordSymbol = pendingChordSymbol
          pendingChordSymbol = undefined
        }
        nodes.push(node)
        break
      }
```

- [ ] **Step 2.6: Run tests, verify pass**

```
npx vitest run src/parser/__tests__/percussion.test.ts
```

- [ ] **Step 2.7: Commit**

```
git add src/parser/types.ts src/parser/tokenizer.ts src/parser/parser.ts src/parser/__tests__/percussion.test.ts
git commit -m "feat(parser): add X<DRUM>:dur percussion note syntax"
```

---

## Task 3: Model converter — wire `percussion` through `nodeToNote`

**Files:**
- Modify: `src/model/converter.ts`

### What this task does

`nodeToNote` builds a `Note` from a `NoteNode`. This task extends it to copy `NoteNode.percussion` into the `NoteData` object so percussion notes survive the parse-to-model pipeline.

- [ ] **Step 3.1: Write a failing integration test**

Append to `src/model/__tests__/percussion.test.ts`:

```typescript
import { nodeToNote } from '../converter.js'
import type { NoteNode } from '../../parser/types.js'

describe('nodeToNote — percussion passthrough', () => {
  it('copies percussion field to Note', () => {
    const node: NoteNode = {
      type: 'note',
      pitch: null,
      accidental: null,
      octave: null,
      duration: 'q',
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: false,
      triplet: false,
      fermata: false,
      percussion: 'SNARE',
    }
    const note = nodeToNote(node)
    expect(note.isPercussion).toBe(true)
    expect(note.percussion).toBe('SNARE')
    expect(note.percussionMidi).toBe(38)
  })
})
```

- [ ] **Step 3.2: Run test, verify it fails**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 3.3: Modify `src/model/converter.ts`**

Find the `nodeToNote` function. Locate the `NoteData` object literal it builds and add the `percussion` field:

```typescript
    percussion: node.percussion,
```

- [ ] **Step 3.4: Run tests, verify pass**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 3.5: Commit**

```
git add src/model/converter.ts src/model/__tests__/percussion.test.ts
git commit -m "feat(model): wire NoteNode.percussion through nodeToNote to Note"
```

---

## Task 4: Renderer — x-notehead + percussion clef

**Files:**
- Modify: `src/model/VoiceModel.ts`
- Modify: `src/adapters/renderer/render-note.ts`
- Modify: `src/adapters/renderer/modifiers.ts`
- Modify: `src/adapters/renderer/VexFlowAdapter.ts`

### What this task does

When a note has `isPercussion === true`, the renderer must:
1. Use `'b/4'` as the VexFlow stave position (mid-line, conventional for percussion).
2. Set `NoteheadType.X` on the `StaveNote` so it draws an x-notehead.
3. When the clef is `'percussion'`, pass `'percussion'` to the VexFlow stave.

VexFlow rendering is not testable in jsdom. We test the data-layer helpers `noteToVexKey` and `noteToVexDuration` via unit tests.

- [ ] **Step 4.1: Extend `Clef` type in `src/model/VoiceModel.ts`**

Change:
```typescript
export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor'
```
To:
```typescript
export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor' | 'percussion'
```

- [ ] **Step 4.2: Write failing tests for `noteToVexKey` on percussion notes**

Append to `src/model/__tests__/percussion.test.ts`:

```typescript
import { noteToVexKey, noteToVexDuration } from '../../adapters/renderer/render-note.js'

describe('noteToVexKey — percussion', () => {
  it('returns b/4 for a percussion note', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false, percussion: 'SNARE',
    }
    const note = new Note(data)
    expect(noteToVexKey(note)).toBe('b/4')
  })
  it('noteToVexDuration is unchanged for percussion (not a rest)', () => {
    const data: NoteData = {
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false, percussion: 'KICK',
    }
    const note = new Note(data)
    expect(noteToVexDuration(note)).toBe('q')
  })
})
```

- [ ] **Step 4.3: Run tests, verify they fail**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 4.4: Modify `src/adapters/renderer/render-note.ts`**

Change `noteToVexKey` to handle percussion:

```typescript
export function noteToVexKey(note: Note): string {
  if (note.isRest) return 'B/4'
  if (note.isPercussion) return 'b/4'
  const acc = note.accidental ?? ''
  return `${note.pitch}${acc}/${note.octave}`
}
```

- [ ] **Step 4.5: Modify `src/adapters/renderer/modifiers.ts`**

Add `NoteheadType` to the vexflow imports at the top:

```typescript
import {
  StaveNote,
  Dot,
  Accidental as VexAccidental,
  Annotation,
  Articulation,
  Ornament as VexOrnament,
  GraceNote,
  GraceNoteGroup,
  NoteheadType,
} from 'vexflow'
```

In `createVexStaveNotes`, after `const staveNote = new StaveNote(...)` and before the `if (pendingGraceNotes.length > 0)` block, add:

```typescript
    // Percussion notes use x-noteheads
    if (rn.sourceNotes[0]?.isPercussion) {
      staveNote.setNoteHead(NoteheadType.X, 0)
    }
```

- [ ] **Step 4.6: Modify `src/adapters/renderer/VexFlowAdapter.ts`**

In `renderSystemLine`, find the line:
```typescript
  const vexClefName = (clef: string) => (clef === 'treble-8' ? 'treble' : clef)
  const vexClefAnnotation = (clef: string) => (clef === 'treble-8' ? '8vb' : undefined)
```

Replace with:
```typescript
  const vexClefName = (clef: string) => {
    if (clef === 'treble-8') return 'treble'
    return clef  // 'percussion', 'bass', 'alto', 'tenor', 'treble' pass through unchanged
  }
  const vexClefAnnotation = (clef: string) => (clef === 'treble-8' ? '8vb' : undefined)
```

- [ ] **Step 4.7: Run all percussion tests**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 4.8: Commit**

```
git add src/model/VoiceModel.ts src/adapters/renderer/render-note.ts src/adapters/renderer/modifiers.ts src/adapters/renderer/VexFlowAdapter.ts src/model/__tests__/percussion.test.ts
git commit -m "feat(renderer): x-notehead and percussion clef support"
```

---

## Task 5: MIDI export — percussion channel 10 routing

**Files:**
- Modify: `src/adapters/export/MIDIAdapter.ts`
- Create: `src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts`

### What this task does

The General MIDI spec reserves channel 10 (1-indexed, or channel index 9) for unpitched drums. When a note has `isPercussion === true`, the MIDI export sends its `percussionMidi` pitch value on channel 10 instead of the melodic pitch on channel 1. `midi-writer-js` accepts a `channel` option on `NoteEvent`.

- [ ] **Step 5.1: Write failing tests**

Create `src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MIDIAdapter } from '../MIDIAdapter.js'
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'

function makePercussionScore(drumName: 'KICK' | 'SNARE' | 'HIHAT'): Score {
  const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
  const part = score.addPart('drums')
  const voice = part.addVoice('drums', 'percussion')
  const note = new Note({
    pitch: 'C', accidental: null, octave: 4, duration: 'q',
    dotted: false, dynamic: null, tied: false, slurred: false,
    chord: false, fermata: false, triplet: false, percussion: drumName,
  })
  voice.addNote(note, score.timeSignature)
  return score
}

describe('MIDIAdapter — percussion channel routing', () => {
  it('exports without throwing for a percussion note', () => {
    const score = makePercussionScore('SNARE')
    expect(() => MIDIAdapter.export(score)).not.toThrow()
  })
  it('produces a non-empty MIDI buffer for a percussion score', () => {
    const score = makePercussionScore('KICK')
    const buffer = MIDIAdapter.export(score)
    expect(buffer.length).toBeGreaterThan(0)
  })
  it('produces a valid MIDI file header (MThd) for a percussion score', () => {
    const score = makePercussionScore('KICK')
    const buffer = MIDIAdapter.export(score)
    // MIDI file starts with 0x4D546864 ("MThd")
    expect(buffer[0]).toBe(0x4d)
    expect(buffer[1]).toBe(0x54)
    expect(buffer[2]).toBe(0x68)
    expect(buffer[3]).toBe(0x64)
  })
})
```

- [ ] **Step 5.2: Run tests, verify they fail**

```
npx vitest run src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts
```

- [ ] **Step 5.3: Modify `src/adapters/export/MIDIAdapter.ts`**

In the single-note branch of the measure notes loop, replace:

```typescript
            } else {
              // Single note
              const event = new NoteEvent({
                pitch: [noteToPitchString(note)],
                duration: noteToDuration(note),
                velocity: DYNAMIC_VELOCITY[note.dynamic ?? ''] ?? DEFAULT_VELOCITY,
                wait: waitDuration || undefined,
              })
              track.addEvent(event)
              waitDuration = undefined
              i++
            }
```

With:

```typescript
            } else {
              // Single note — route percussion to channel 10
              if (note.isPercussion && note.percussionMidi !== null) {
                const event = new NoteEvent({
                  pitch: [note.percussionMidi],
                  channel: 10,
                  duration: noteToDuration(note),
                  velocity: DYNAMIC_VELOCITY[note.dynamic ?? ''] ?? DEFAULT_VELOCITY,
                  wait: waitDuration || undefined,
                })
                track.addEvent(event)
              } else {
                const event = new NoteEvent({
                  pitch: [noteToPitchString(note)],
                  duration: noteToDuration(note),
                  velocity: DYNAMIC_VELOCITY[note.dynamic ?? ''] ?? DEFAULT_VELOCITY,
                  wait: waitDuration || undefined,
                })
                track.addEvent(event)
              }
              waitDuration = undefined
              i++
            }
```

- [ ] **Step 5.4: Run tests, verify pass**

```
npx vitest run src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts
```

- [ ] **Step 5.5: Commit**

```
git add src/adapters/export/MIDIAdapter.ts src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts
git commit -m "feat(midi): route percussion notes to channel 10 with GM drum map MIDI numbers"
```

---

## Task 6: SoundfontAdapter — percussion audio routing

**Files:**
- Modify: `src/adapters/audio/SoundfontAdapter.ts`

### What this task does

`SoundfontAdapter.play()` must not throw when the score contains percussion notes. Since CDN soundfont files do not include channel-10 drum kits, percussion notes are silently skipped (the `scheduleNote` call is a no-op when no buffer is loaded for that MIDI number). The key requirement is no crash.

- [ ] **Step 6.1: Write failing test**

Append to `src/adapters/audio/__tests__/SoundfontAdapter.test.ts`:

```typescript
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'

describe('SoundfontAdapter — percussion notes do not throw', () => {
  it('load() accepts a score with percussion notes without throwing', () => {
    const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
    const part = score.addPart('drums')
    const voice = part.addVoice('drums', 'percussion')
    const note = new Note({
      pitch: 'C', accidental: null, octave: 4, duration: 'q',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false, percussion: 'SNARE',
    })
    voice.addNote(note, score.timeSignature)
    const adapter = new SoundfontAdapter()
    expect(() => adapter.load(score, { instrument: 'piano' })).not.toThrow()
  })
})
```

- [ ] **Step 6.2: Run test, verify it fails**

```
npx vitest run src/adapters/audio/__tests__/SoundfontAdapter.test.ts
```

- [ ] **Step 6.3: Modify `src/adapters/audio/SoundfontAdapter.ts`**

Locate the private method that schedules individual note playback (the method that calls `this.buffers.get(midi)` or equivalent). Ensure it has an early return when no buffer is found:

```typescript
  private scheduleNote(midi: number, time: number, duration: number, velocity: number): void {
    const buffer = this.buffers.get(midi)
    if (!buffer) return  // no sample loaded — percussion hits are silently skipped
    // ... rest of existing scheduling logic unchanged
  }
```

In the timeline playback loop where notes are dispatched to `scheduleNote`, add a guard for percussion notes so they use their MIDI drum number rather than the standard pitch MIDI. Look for the section that calls `scheduleNote` (or the equivalent audio scheduling logic) and add:

```typescript
    // For percussion notes, use the GM drum MIDI number if available;
    // the buffer lookup will return undefined (no drum kit loaded) and the note is silently skipped.
    const midiToPlay = event.note?.isPercussion
      ? (event.note.percussionMidi ?? event.note.midi)
      : event.note?.midi
    if (midiToPlay !== null && midiToPlay !== undefined) {
      this.scheduleNote(midiToPlay, ...)
    }
```

If the timeline `NoteEvent` does not carry a `Note` reference, locate where `event.midi` is read and confirm the `scheduleNote` no-op guard (missing buffer) handles the unknown percussion MIDI number silently.

- [ ] **Step 6.4: Run test, verify pass**

```
npx vitest run src/adapters/audio/__tests__/SoundfontAdapter.test.ts
```

- [ ] **Step 6.5: Commit**

```
git add src/adapters/audio/SoundfontAdapter.ts src/adapters/audio/__tests__/SoundfontAdapter.test.ts
git commit -m "feat(audio): handle percussion notes gracefully in SoundfontAdapter"
```

---

## Task 7: Tablature rendering — `TabRenderer` pitch-to-fret algorithm

**Files:**
- Create: `src/adapters/renderer/TabRenderer.ts`
- Create: `src/adapters/renderer/__tests__/TabRenderer.test.ts`

### What this task does

Adds a `pitchToFret(midi, tuning)` pure function that maps a MIDI note number to its optimal `{ string, fret }` position on a stringed instrument. Provides four standard tuning presets. VexFlow rendering is not testable in jsdom — only the algorithm is tested.

- [ ] **Step 7.1: Write failing tests**

Create `src/adapters/renderer/__tests__/TabRenderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pitchToFret, TUNINGS } from '../TabRenderer.js'

describe('TUNINGS', () => {
  it('guitar standard has 6 strings', () => {
    expect(TUNINGS.guitar.length).toBe(6)
  })
  it('bass has 4 strings', () => {
    expect(TUNINGS.bass.length).toBe(4)
  })
  it('guitar standard lowest string open = E2 (MIDI 40)', () => {
    // index 0 = lowest string = E2
    expect(TUNINGS.guitar[0]).toBe(40)
  })
  it('drop-D lowest string open = D2 (MIDI 38)', () => {
    expect(TUNINGS.dropD[0]).toBe(38)
  })
  it('mandolin has 4 strings', () => {
    expect(TUNINGS.mandolin.length).toBe(4)
  })
})

describe('pitchToFret', () => {
  it('maps E2 (MIDI 40) on guitar standard to string 6, fret 0', () => {
    // String 6 is the lowest E string (conventional 1-based from high to low)
    const result = pitchToFret(40, TUNINGS.guitar)
    expect(result.string).toBe(6)
    expect(result.fret).toBe(0)
  })
  it('maps F2 (MIDI 41) on guitar standard to string 6, fret 1', () => {
    const result = pitchToFret(41, TUNINGS.guitar)
    expect(result.string).toBe(6)
    expect(result.fret).toBe(1)
  })
  it('maps A4 (MIDI 69) on guitar standard to a valid position', () => {
    const result = pitchToFret(69, TUNINGS.guitar)
    expect(result.fret).toBeGreaterThanOrEqual(0)
    expect(result.fret).toBeLessThanOrEqual(24)
    expect(result.string).toBeGreaterThanOrEqual(1)
    expect(result.string).toBeLessThanOrEqual(6)
  })
  it('returns the lowest-fret position for C4 (fret <= 12)', () => {
    const result = pitchToFret(60, TUNINGS.guitar)
    expect(result.fret).toBeLessThanOrEqual(12)
  })
  it('A2 (MIDI 45) is string 5 open on standard guitar (fret 0)', () => {
    const result = pitchToFret(45, TUNINGS.guitar)
    expect(result.fret).toBe(0)
  })
  it('D2 (MIDI 38) on bass standard is string 2, fret 0', () => {
    // Bass strings low-to-high: E1=28, A1=33, D2=38, G2=43
    // String 2 (from high) = D2
    const result = pitchToFret(38, TUNINGS.bass)
    expect(result.fret).toBe(0)
  })
})
```

- [ ] **Step 7.2: Run tests, verify they fail**

```
npx vitest run src/adapters/renderer/__tests__/TabRenderer.test.ts
```

- [ ] **Step 7.3: Create `src/adapters/renderer/TabRenderer.ts`**

```typescript
/**
 * TabRenderer — tablature pitch-to-fret algorithm and VexFlow TabStave/TabNote builder.
 *
 * Tuning arrays store MIDI note numbers of open strings,
 * ordered from LOWEST string to HIGHEST (index 0 = lowest string).
 */

/** MIDI note numbers of open strings ordered lowest to highest (index 0 = lowest). */
export type Tuning = readonly number[]

export const TUNINGS: Record<string, Tuning> = {
  /** Standard guitar: E2 A2 D3 G3 B3 E4 */
  guitar:   [40, 45, 50, 55, 59, 64],
  /** Drop D guitar: D2 A2 D3 G3 B3 E4 */
  dropD:    [38, 45, 50, 55, 59, 64],
  /** Standard bass: E1 A1 D2 G2 */
  bass:     [28, 33, 38, 43],
  /** Mandolin: G3 D4 A4 E5 */
  mandolin: [55, 62, 69, 76],
}

export interface FretPosition {
  /**
   * 1-based string number counting from the HIGHEST string.
   * String 1 = highest pitch string, String N = lowest pitch string.
   * (Matches standard guitar tab notation conventions.)
   */
  string: number
  fret: number
}

/**
 * Find the best (lowest fret) position for a given MIDI pitch on a given tuning.
 *
 * Algorithm:
 * 1. For each string (from highest to lowest), compute fret = midi - openMidi.
 * 2. Discard positions where fret < 0 or fret > 24.
 * 3. Return the position with the lowest fret. Ties broken by preferring
 *    the string with the smaller 1-based string number (higher-pitched string).
 */
export function pitchToFret(midi: number, tuning: Tuning): FretPosition {
  const numStrings = tuning.length
  let bestFret = Infinity
  let bestString = 1

  for (let i = 0; i < numStrings; i++) {
    // Convert tuning index (0 = lowest) to conventional string number (1 = highest)
    const stringNumber = numStrings - i
    const openMidi = tuning[i]
    const fret = midi - openMidi
    if (fret >= 0 && fret <= 24) {
      if (fret < bestFret || (fret === bestFret && stringNumber < bestString)) {
        bestFret = fret
        bestString = stringNumber
      }
    }
  }

  if (bestFret === Infinity) {
    return { string: 1, fret: 0 }
  }

  return { string: bestString, fret: bestFret }
}

/**
 * Build VexFlow TabNote position objects from an array of MIDI pitches and a tuning.
 * Returns an array of { str, fret } objects for `new TabNote({ positions: [...] })`.
 *
 * Called only from VexFlowAdapter at runtime (not testable in jsdom).
 */
export function midiToTabPositions(
  midis: number[],
  tuning: Tuning
): Array<{ str: number; fret: number }> {
  return midis.map((midi) => {
    const pos = pitchToFret(midi, tuning)
    return { str: pos.string, fret: pos.fret }
  })
}
```

- [ ] **Step 7.4: Run tests, verify pass**

```
npx vitest run src/adapters/renderer/__tests__/TabRenderer.test.ts
```

- [ ] **Step 7.5: Commit**

```
git add src/adapters/renderer/TabRenderer.ts src/adapters/renderer/__tests__/TabRenderer.test.ts
git commit -m "feat(renderer): add TabRenderer with pitch-to-fret algorithm and standard tuning presets"
```

---

## Task 8: Tablature rendering — VexFlow TabStave/TabNote in VexFlowAdapter

**Files:**
- Modify: `src/model/VoiceModel.ts` — add `'tab'` to `Clef`
- Modify: `src/adapters/renderer/VexFlowAdapter.ts` — render TabStave when clef is `'tab'`
- Modify: `src/adapters/renderer/__tests__/TabRenderer.test.ts` — add smoke test

### What this task does

When a voice has `clef === 'tab'`, `renderSystemLine` renders a `TabStave` (below the standard stave by 80px) and populates it with `TabNote` objects from `midiToTabPositions`. There are no unit tests — VexFlow rendering requires DOM. A smoke test confirms `exportSVG()` does not throw.

- [ ] **Step 8.1: Extend `Clef` type in `src/model/VoiceModel.ts`**

Change:
```typescript
export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor' | 'percussion'
```
To:
```typescript
export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor' | 'percussion' | 'tab'
```

- [ ] **Step 8.2: Add VexFlow tab imports to `VexFlowAdapter.ts`**

Add `TabStave` and `TabNote` to the vexflow import list at the top:

```typescript
import {
  // ... existing imports ...
  TabStave,
  TabNote,
} from 'vexflow'
```

Add the TabRenderer import:

```typescript
import { midiToTabPositions, TUNINGS } from './TabRenderer.js'
```

- [ ] **Step 8.3: Add tab stave rendering in `renderSystemLine`**

After the existing `for (let vi = 0; vi < voiceLayouts.length; vi++)` loop (and after the spanner / grand staff connector block), add a second pass for tab voices:

```typescript
  // Second pass: render TabStave for voices with clef === 'tab'
  for (let vi = 0; vi < voiceLayouts.length; vi++) {
    const { layout, clef } = voiceLayouts[vi]
    if (clef !== 'tab') continue
    if (li >= layout.lines.length) continue

    const line = layout.lines[li]
    if (line.measures.length === 0) continue

    const keyAccidentals = KEY_ACCIDENTAL_COUNT[score.key] ?? 0
    const firstMeasureExtra = 60 + keyAccidentals * 12 + (li === 0 ? 20 : 0)
    const totalStaveWidth = opts.width - opts.padding * 2
    const measureWidth = (totalStaveWidth - firstMeasureExtra) / line.measures.length

    // Tab stave is rendered 80px below the standard system
    const tabY = line.y + 80
    let xPos = opts.padding

    for (let mi = 0; mi < line.measures.length; mi++) {
      const measure = line.measures[mi]
      const isFirstMeasure = mi === 0
      const w = isFirstMeasure ? measureWidth + firstMeasureExtra : measureWidth
      const staveWidth =
        isFirstMeasure && measure.isPickup ? Math.max(80, Math.round(measure.totalBeats * 50)) : w

      const tabStave = new TabStave(xPos, tabY, staveWidth)
      if (isFirstMeasure) tabStave.addClef('tab')
      tabStave.setContext(context).draw()

      const rawNotes = measure.getNotes().filter((n) => !n.isRest)
      const tuning = TUNINGS.guitar

      const tabNotes = rawNotes.map((note) => {
        const midi = note.isPercussion ? (note.percussionMidi ?? 60) : (note.midi ?? 60)
        const positions = midiToTabPositions([midi], tuning)
        return new TabNote({ positions, duration: note.duration })
      })

      if (tabNotes.length > 0) {
        try {
          const tabVoice = new VexVoice({
            numBeats: measure.timeSignature.beats,
            beatValue: parseInt(durationToDenom(measure.timeSignature.noteValue ?? 'q')),
          }).setMode(VoiceMode.SOFT)
          tabVoice.addTickables(tabNotes)
          new Formatter().joinVoices([tabVoice]).format([tabVoice], staveWidth - 40)
          tabVoice.draw(context, tabStave)
        } catch {
          // Skip malformed tab measure without crashing the render
        }
      }

      xPos += staveWidth
    }
  }
```

- [ ] **Step 8.4: Add smoke test to `TabRenderer.test.ts`**

Append to `src/adapters/renderer/__tests__/TabRenderer.test.ts`:

```typescript
import { Song } from '../../../api/Song.js'

describe('tab voice smoke test', () => {
  it('exportSVG does not throw with a tab voice', () => {
    const song = new Song({ tempo: 120 })
    song.voice('guitar', { clef: 'tab' }).add('C4:q D4:q E4:q F4:q')
    expect(() => song.exportSVG()).not.toThrow()
  })
})
```

- [ ] **Step 8.5: Run smoke test**

```
npx vitest run src/adapters/renderer/__tests__/TabRenderer.test.ts
```

- [ ] **Step 8.6: Commit**

```
git add src/model/VoiceModel.ts src/adapters/renderer/VexFlowAdapter.ts src/adapters/renderer/__tests__/TabRenderer.test.ts
git commit -m "feat(renderer): render TabStave/TabNote for voices with clef='tab'"
```

---

## Task 9: Chord Grid View — pure-SVG renderer

**Files:**
- Create: `src/adapters/renderer/ChordGridRenderer.ts`
- Create: `src/adapters/renderer/__tests__/ChordGridRenderer.test.ts`
- Modify: `src/api/Song.ts`
- Create: `src/api/__tests__/Song.chordgrid.test.ts`

### What this task does

Extracts the chord symbol sequence from the score (one per measure, from the first note with a `chordSymbol`) and renders an SVG grid: each cell is one measure, showing the chord name and four rhythm slashes. The renderer is pure string concatenation — no VexFlow, no DOM dependency.

**Note on SVG injection:** `Song.renderChordGrid` sets the container's content to the generated SVG string. The generated SVG is produced entirely by `ChordGridRenderer` from controlled score data (not user-supplied HTML), so the content is safe. Use `element.innerHTML = svgString` — the content is first-party generated SVG, not unsanitized user input.

- [ ] **Step 9.1: Write failing tests for `ChordGridRenderer`**

Create `src/adapters/renderer/__tests__/ChordGridRenderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  ChordGridRenderer,
  type ChordGridOptions,
  extractChordSequence,
} from '../ChordGridRenderer.js'
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'

function makeChordScore(): Score {
  const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
  const part = score.addPart('chords')
  const voice = part.addVoice('chords', 'treble')
  const chords = ['Cmaj7', 'Am7', 'Fmaj7', 'G7']
  for (const sym of chords) {
    const note = new Note({
      pitch: 'C', accidental: null, octave: 4, duration: 'w',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false,
      chordSymbol: sym,
    })
    voice.addNote(note, score.timeSignature)
  }
  return score
}

describe('extractChordSequence', () => {
  it('returns one chord symbol per measure', () => {
    const score = makeChordScore()
    const seq = extractChordSequence(score)
    expect(seq).toHaveLength(4)
    expect(seq[0]).toBe('Cmaj7')
    expect(seq[1]).toBe('Am7')
    expect(seq[2]).toBe('Fmaj7')
    expect(seq[3]).toBe('G7')
  })
  it('returns empty string for measures with no chord symbol', () => {
    const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
    const part = score.addPart('p')
    const voice = part.addVoice('v', 'treble')
    const note = new Note({
      pitch: 'C', accidental: null, octave: 4, duration: 'w',
      dotted: false, dynamic: null, tied: false, slurred: false,
      chord: false, fermata: false, triplet: false,
    })
    voice.addNote(note, score.timeSignature)
    const seq = extractChordSequence(score)
    expect(seq).toHaveLength(1)
    expect(seq[0]).toBe('')
  })
})

describe('ChordGridRenderer.render', () => {
  it('returns a string containing svg element', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
  it('contains chord symbol text for each measure', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('Cmaj7')
    expect(svg).toContain('Am7')
    expect(svg).toContain('Fmaj7')
    expect(svg).toContain('G7')
  })
  it('respects cellsPerRow option — 2 rows of 2 cells at cellHeight 80 = height 160', () => {
    const score = makeChordScore()
    const opts: ChordGridOptions = { cellsPerRow: 2, cellWidth: 100, cellHeight: 80 }
    const svg = ChordGridRenderer.render(score, opts)
    expect(svg).toContain('height="160"')
  })
  it('renders bar numbers when showBarNumbers is true', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score, { showBarNumbers: true })
    expect(svg).toContain('>1<')
    expect(svg).toContain('>2<')
  })
  it('renders rhythm slash characters inside each cell', () => {
    const score = makeChordScore()
    const svg = ChordGridRenderer.render(score)
    expect(svg).toContain('/')
  })
})
```

- [ ] **Step 9.2: Run tests, verify they fail**

```
npx vitest run src/adapters/renderer/__tests__/ChordGridRenderer.test.ts
```

- [ ] **Step 9.3: Create `src/adapters/renderer/ChordGridRenderer.ts`**

```typescript
import type { Score } from '../../model/Score.js'

export interface ChordGridOptions {
  cellsPerRow?: number      // default 4
  cellWidth?: number        // default 160
  cellHeight?: number       // default 100
  showBarNumbers?: boolean  // default false
  fontSize?: number         // default 16
}

const DEFAULTS: Required<ChordGridOptions> = {
  cellsPerRow: 4,
  cellWidth: 160,
  cellHeight: 100,
  showBarNumbers: false,
  fontSize: 16,
}

/**
 * Extract the first chord symbol from each measure across all voices of the first part.
 * Returns one entry per measure; empty string when no chord symbol is present.
 */
export function extractChordSequence(score: Score): string[] {
  const firstPart = score.getParts()[0]
  if (!firstPart) return []

  const voices = firstPart.getVoices()
  if (voices.length === 0) return []

  const maxMeasures = Math.max(...voices.map((v) => v.getMeasures().length))
  const result: string[] = []

  for (let mi = 0; mi < maxMeasures; mi++) {
    let sym = ''
    for (const voice of voices) {
      const measure = voice.getMeasures()[mi]
      if (!measure) continue
      for (const note of measure.getNotes()) {
        if (note.chordSymbol) {
          sym = note.chordSymbol
          break
        }
      }
      if (sym) break
    }
    result.push(sym)
  }

  return result
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Render a chord grid as an SVG string.
 * Each cell represents one measure: chord symbol at top, rhythm slashes in the middle,
 * and an optional bar number at bottom-left.
 */
export class ChordGridRenderer {
  static render(score: Score, options: ChordGridOptions = {}): string {
    const opts = { ...DEFAULTS, ...options }
    const chords = extractChordSequence(score)
    const numMeasures = chords.length

    if (numMeasures === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.cellWidth}" height="${opts.cellHeight}"></svg>`
    }

    const cols = opts.cellsPerRow
    const rows = Math.ceil(numMeasures / cols)
    const totalWidth = cols * opts.cellWidth
    const totalHeight = rows * opts.cellHeight

    const cells: string[] = []

    for (let i = 0; i < numMeasures; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = col * opts.cellWidth
      const y = row * opts.cellHeight
      const sym = chords[i]

      // Cell border rectangle
      cells.push(
        `<rect x="${x}" y="${y}" width="${opts.cellWidth}" height="${opts.cellHeight}" fill="none" stroke="#000" stroke-width="1"/>`
      )

      // Chord symbol text
      if (sym) {
        cells.push(
          `<text x="${x + 8}" y="${y + opts.fontSize + 6}" font-family="serif" font-size="${opts.fontSize}" font-weight="bold" fill="#000">${escapeXML(sym)}</text>`
        )
      }

      // Four rhythm slashes evenly spaced across the cell
      const slashY = y + Math.round(opts.cellHeight * 0.6)
      const slashSpacing = opts.cellWidth / 5
      for (let s = 0; s < 4; s++) {
        const sx = Math.round(x + slashSpacing * (s + 1))
        cells.push(
          `<text x="${sx}" y="${slashY}" font-family="serif" font-size="${opts.fontSize}" fill="#555" text-anchor="middle">/</text>`
        )
      }

      // Bar number
      if (opts.showBarNumbers) {
        cells.push(
          `<text x="${x + 4}" y="${y + opts.cellHeight - 4}" font-family="sans-serif" font-size="10" fill="#888">${i + 1}</text>`
        )
      }
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">`,
      ...cells,
      `</svg>`,
    ].join('\n')
  }
}
```

- [ ] **Step 9.4: Run tests, verify pass**

```
npx vitest run src/adapters/renderer/__tests__/ChordGridRenderer.test.ts
```

- [ ] **Step 9.5: Write failing tests for `Song.renderChordGrid`**

Create `src/api/__tests__/Song.chordgrid.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Song } from '../Song.js'

describe('Song.renderChordGrid', () => {
  it('injects SVG into target element', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Cmaj7" C4:w | @"Am7" A3:w | @"Fmaj7" F3:w | @"G7" G3:w')
    song.renderChordGrid(div)
    expect(div.innerHTML).toContain('<svg')
    expect(div.innerHTML).toContain('Cmaj7')
    document.body.removeChild(div)
  })
  it('accepts a CSS selector string', () => {
    const div = document.createElement('div')
    div.id = 'chord-grid-test'
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Dm7" D4:w | @"G7" G3:w')
    song.renderChordGrid('#chord-grid-test')
    expect(div.innerHTML).toContain('Dm7')
    document.body.removeChild(div)
  })
  it('throws when target not found', () => {
    const song = new Song()
    song.add('C4:q')
    expect(() => song.renderChordGrid('#does-not-exist')).toThrow()
  })
  it('accepts ChordGridOptions', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"Cmaj7" C4:w | @"Dm7" D4:w | @"Em7" E4:w | @"Fmaj7" F4:w')
    song.renderChordGrid(div, { cellsPerRow: 2, showBarNumbers: true })
    expect(div.innerHTML).toContain('>1<')
    document.body.removeChild(div)
  })
  it('returns this for chaining', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('@"C" C4:w')
    const result = song.renderChordGrid(div)
    expect(result).toBe(song)
    document.body.removeChild(div)
  })
})
```

- [ ] **Step 9.6: Run tests, verify they fail**

```
npx vitest run src/api/__tests__/Song.chordgrid.test.ts
```

- [ ] **Step 9.7: Modify `src/api/Song.ts`**

Add import near the top of the file (after VexFlowAdapter import):

```typescript
import { ChordGridRenderer } from '../adapters/renderer/ChordGridRenderer.js'
import type { ChordGridOptions } from '../adapters/renderer/ChordGridRenderer.js'
```

Add the method to the `Song` class (after `exportSVG`):

```typescript
  /**
   * Render a chord grid (jazz lead-sheet style) into a target element.
   * Each cell = one measure showing the chord symbol and rhythm slashes.
   * Chord symbols are sourced from @"Chord" annotations in the notation.
   *
   * The SVG content is generated entirely from the score model (first-party data),
   * so injecting it as the element's HTML content is safe.
   *
   * @param target CSS selector string or HTMLElement
   * @param options Optional grid layout options
   */
  renderChordGrid(target: string | HTMLElement, options?: ChordGridOptions): this {
    const element =
      typeof target === 'string'
        ? typeof document !== 'undefined'
          ? document.querySelector(target)
          : null
        : target

    if (!element) {
      throw new Error(`renderChordGrid target "${String(target)}" not found.`)
    }

    const svgString = ChordGridRenderer.render(this.score, options)
    // svgString is generated from score model data, not user-supplied HTML
    ;(element as HTMLElement).innerHTML = svgString
    return this
  }
```

- [ ] **Step 9.8: Run tests, verify pass**

```
npx vitest run src/api/__tests__/Song.chordgrid.test.ts
```

- [ ] **Step 9.9: Commit**

```
git add src/adapters/renderer/ChordGridRenderer.ts src/adapters/renderer/__tests__/ChordGridRenderer.test.ts src/api/Song.ts src/api/__tests__/Song.chordgrid.test.ts
git commit -m "feat(api): add Song.renderChordGrid with pure-SVG chord grid renderer"
```

---

## Task 10: ARIA Accessibility labels

**Files:**
- Modify: `src/adapters/renderer/types.ts`
- Modify: `src/adapters/renderer/VexFlowAdapter.ts`
- Modify: `src/api/Song.ts`
- Create: `src/api/__tests__/Song.aria.test.ts`

### What this task does

After VexFlow renders each system, a post-render DOM pass adds ARIA attributes:
- Render target `<div>`: `role="img"` + `aria-label="Sheet music: [title]"` (or `"Sheet music"` if no title)
- Each child SVG element: `role="img"` + `aria-label`

This is opt-in via `render(target, { ariaLabel: true })`.

- [ ] **Step 10.1: Write failing tests**

Create `src/api/__tests__/Song.aria.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Song } from '../Song.js'

describe('ARIA labels — container', () => {
  it('render target gets role=img and aria-label containing the song title', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song({ title: 'Ode to Joy' })
    song.add('C4:q D4:q E4:q F4:q')
    song.render(div, { ariaLabel: true })
    expect(div.getAttribute('role')).toBe('img')
    expect(div.getAttribute('aria-label')).toContain('Ode to Joy')
    document.body.removeChild(div)
  })
  it('render target gets aria-label "Sheet music" when no title', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    song.render(div, { ariaLabel: true })
    expect(div.getAttribute('role')).toBe('img')
    expect(div.getAttribute('aria-label')).toBe('Sheet music')
    document.body.removeChild(div)
  })
  it('no aria attributes when ariaLabel is not set (default)', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song({ title: 'Test' })
    song.add('C4:q')
    song.render(div)
    expect(div.getAttribute('role')).toBeNull()
    document.body.removeChild(div)
  })
})
```

- [ ] **Step 10.2: Run tests, verify they fail**

```
npx vitest run src/api/__tests__/Song.aria.test.ts
```

- [ ] **Step 10.3: Add `ariaLabel` to renderer `RenderOptions` in `src/adapters/renderer/types.ts`**

In the `RenderOptions` interface, add:

```typescript
  ariaLabel?: boolean  // default false — adds role="img" + aria-label to the render container and SVGs
```

In `DEFAULT_RENDER_OPTIONS`, add:

```typescript
  ariaLabel: false,
```

- [ ] **Step 10.4: Add `ariaLabel` to Song-level `RenderOptions` in `src/api/Song.ts`**

In the `RenderOptions` interface exported from `Song.ts`, add:

```typescript
  ariaLabel?: boolean
```

In `toRendererOptions`, add:

```typescript
    if (options.ariaLabel !== undefined) opts.ariaLabel = options.ariaLabel
```

- [ ] **Step 10.5: Apply ARIA attributes in `VexFlowAdapter.render`**

At the end of the `VexFlowAdapter.render` static method, before `return new Map()`, add:

```typescript
    if (opts.ariaLabel) {
      const label = score.title ? `Sheet music: ${score.title}` : 'Sheet music'
      target.setAttribute('role', 'img')
      target.setAttribute('aria-label', label)
      const svgs = target.querySelectorAll('svg')
      svgs.forEach((svg) => {
        svg.setAttribute('role', 'img')
        if (!svg.hasAttribute('aria-label')) {
          svg.setAttribute('aria-label', label)
        }
      })
    }
```

- [ ] **Step 10.6: Run tests, verify pass**

```
npx vitest run src/api/__tests__/Song.aria.test.ts
```

- [ ] **Step 10.7: Commit**

```
git add src/adapters/renderer/types.ts src/adapters/renderer/VexFlowAdapter.ts src/api/Song.ts src/api/__tests__/Song.aria.test.ts
git commit -m "feat(a11y): add ariaLabel render option — role=img + aria-label on SVG container"
```

---

## Task 11: Exports — expose new public API from `index.ts`

**Files:**
- Modify: `src/index.ts`

### What this task does

Adds the Phase 3 public symbols to the barrel export.

- [ ] **Step 11.1: Write a failing test that imports from `index.ts`**

Append to `src/model/__tests__/percussion.test.ts`:

```typescript
import { GM_DRUM_MAP as IndexDrumMap, PERCUSSION_INSTRUMENTS as IndexInstruments } from '../../index.js'

describe('index.ts re-exports for percussion', () => {
  it('GM_DRUM_MAP is exported from index', () => {
    expect(IndexDrumMap).toBeDefined()
    expect(IndexDrumMap['KICK']).toBe(36)
  })
  it('PERCUSSION_INSTRUMENTS is exported from index', () => {
    expect(Array.isArray(IndexInstruments)).toBe(true)
    expect(IndexInstruments).toContain('SNARE')
  })
})
```

- [ ] **Step 11.2: Run test, verify it fails**

```
npx vitest run src/model/__tests__/percussion.test.ts
```

- [ ] **Step 11.3: Modify `src/index.ts`**

After the existing model exports block, add:

```typescript
// Phase 3 — Percussion
export { GM_DRUM_MAP, PERCUSSION_INSTRUMENTS } from './model/percussion.js'
export type { PercussionInstrument } from './model/percussion.js'

// Phase 3 — Tablature
export { pitchToFret, midiToTabPositions, TUNINGS } from './adapters/renderer/TabRenderer.js'
export type { FretPosition, Tuning } from './adapters/renderer/TabRenderer.js'

// Phase 3 — Chord Grid
export { ChordGridRenderer, extractChordSequence } from './adapters/renderer/ChordGridRenderer.js'
export type { ChordGridOptions } from './adapters/renderer/ChordGridRenderer.js'
```

- [ ] **Step 11.4: Run all Phase 3 tests together**

```
npx vitest run src/model/__tests__/percussion.test.ts src/parser/__tests__/percussion.test.ts src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts src/adapters/renderer/__tests__/TabRenderer.test.ts src/adapters/renderer/__tests__/ChordGridRenderer.test.ts src/api/__tests__/Song.chordgrid.test.ts src/api/__tests__/Song.aria.test.ts
```

- [ ] **Step 11.5: Run full test suite to confirm no regressions**

```
npx vitest run
```

- [ ] **Step 11.6: Commit**

```
git add src/index.ts src/model/__tests__/percussion.test.ts
git commit -m "feat(exports): expose Phase 3 percussion, tab, and chord grid symbols from index"
```

---

## Summary of all new files

| File | Purpose |
|------|---------|
| `src/model/percussion.ts` | `PercussionInstrument` type + `GM_DRUM_MAP` constant |
| `src/model/__tests__/percussion.test.ts` | Tests for model, converter, render-note helpers, and index re-exports |
| `src/parser/__tests__/percussion.test.ts` | Tests for `X<DRUM>:dur` tokenizer and parser |
| `src/adapters/export/__tests__/MIDIAdapter.percussion.test.ts` | Tests for MIDI channel 10 routing |
| `src/adapters/renderer/TabRenderer.ts` | `pitchToFret` algorithm + `TUNINGS` presets + `midiToTabPositions` |
| `src/adapters/renderer/__tests__/TabRenderer.test.ts` | Unit tests for pitch-to-fret + tab smoke test |
| `src/adapters/renderer/ChordGridRenderer.ts` | Pure-SVG chord grid renderer |
| `src/adapters/renderer/__tests__/ChordGridRenderer.test.ts` | Tests for chord grid |
| `src/api/__tests__/Song.chordgrid.test.ts` | Tests for `Song.renderChordGrid` |
| `src/api/__tests__/Song.aria.test.ts` | Tests for ARIA label option |

## Summary of modified files

| File | Change |
|------|--------|
| `src/model/types.ts` | Add `percussion?: PercussionInstrument` to `NoteData` |
| `src/model/Note.ts` | Add `percussion` field, `isPercussion` getter, `percussionMidi` getter |
| `src/model/VoiceModel.ts` | Add `'percussion'` and `'tab'` to `Clef` union |
| `src/model/converter.ts` | Copy `node.percussion` into `NoteData` in `nodeToNote` |
| `src/parser/types.ts` | Add `'PERCUSSION'` to `TokenType`; add `percussion?` to `NoteNode` |
| `src/parser/tokenizer.ts` | Tokenize `X<DRUM>:dur` before the NOTE branch |
| `src/parser/parser.ts` | Parse `PERCUSSION` token into `NoteNode` |
| `src/adapters/renderer/render-note.ts` | `noteToVexKey` returns `b/4` for percussion notes |
| `src/adapters/renderer/modifiers.ts` | Apply `NoteheadType.X` for percussion in `createVexStaveNotes` |
| `src/adapters/renderer/VexFlowAdapter.ts` | Percussion clef pass-through; tab stave rendering; ARIA post-pass |
| `src/adapters/renderer/types.ts` | Add `ariaLabel?: boolean` to `RenderOptions` |
| `src/adapters/export/MIDIAdapter.ts` | Channel 10 routing for percussion notes |
| `src/adapters/audio/SoundfontAdapter.ts` | Guard percussion notes to avoid crash |
| `src/api/Song.ts` | Add `renderChordGrid()`; add `ariaLabel` to `RenderOptions` |
| `src/index.ts` | Export Phase 3 public API |
