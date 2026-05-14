# Phase 1 — Musical Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pickup measures (anacrusis), multi-measure rests, and precise timing callbacks to maestro-js so it correctly handles real-world music notation.

**Architecture:** Three independent features sharing the model layer. Pickup measures require a flag on `Measure` + parser detection + renderer special-case. Multi-measure rests add a compact token and VexFlow `StaveMultiMeasureRest`. Timing callbacks extract audio-clock-accurate events from the Tone.js `Draw` API into a new `TimingCallbacks` class.

**Tech Stack:** TypeScript, VexFlow 5, Tone.js 15, Vitest

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/model/Measure.ts` — add `isPickup` flag + `pickupBeats` |
| Modify | `src/model/VoiceModel.ts` — auto-detect pickup on first measure |
| Modify | `src/model/Note.ts` — add `multiMeasureRest?: number` field |
| Modify | `src/model/types.ts` — add `multiMeasureRest` to `NoteData` |
| Modify | `src/parser/parser.ts` — parse `R:Nm` multi-measure rest token |
| Modify | `src/adapters/renderer/VexFlowAdapter.ts` — render pickup + multi-rest |
| Modify | `src/adapters/audio/ToneAdapter.ts` — use Tone.Draw for precise callbacks |
| Modify | `src/scheduler/timeline.ts` — add `NoteTimingEvent` interface |
| Create | `src/scheduler/TimingCallbacks.ts` — new timing callback class |
| Modify | `src/api/Song.ts` — expose `TimingCallbacks` + `setPickup()` |
| Modify | `src/model/__tests__/Measure.test.ts` — pickup tests |
| Modify | `src/model/__tests__/VoiceModel.test.ts` — pickup auto-detect tests |
| Modify | `src/model/__tests__/Note.test.ts` — multi-measure rest tests |
| Modify | `src/parser/__tests__/parser.test.ts` — `R:Nm` syntax tests |
| Create | `src/scheduler/__tests__/TimingCallbacks.test.ts` |

---

## Task 1: Add `isPickup` flag to `Measure`

**Files:**
- Modify: `src/model/Measure.ts`
- Modify: `src/model/__tests__/Measure.test.ts`

- [ ] **Step 1.1: Write failing tests**

Find and open `src/model/__tests__/Measure.test.ts`. Add at the bottom:

```typescript
describe('Measure pickup flag', () => {
  it('isPickup defaults to false', () => {
    const m = new Measure({ beats: 4, noteValue: 'q' })
    expect(m.isPickup).toBe(false)
  })

  it('isPickup is true when constructed with isPickup: true', () => {
    const m = new Measure({ beats: 4, noteValue: 'q' }, null, true)
    expect(m.isPickup).toBe(true)
  })

  it('pickup measure allows fewer beats than capacity without being considered full', () => {
    const m = new Measure({ beats: 4, noteValue: 'q' }, null, true)
    const note = new Note({
      pitch: 'C', accidental: null, octave: 4, duration: 'q', dotted: false,
      dynamic: null, tied: false, slurred: false, chord: false,
      fermata: false, breath: false, triplet: false,
    })
    m.addNote(note, true)
    // One quarter in a 4/4 pickup — measure is NOT full (pickup stops when notes run out)
    expect(m.totalBeats).toBe(1)
    expect(m.isFull).toBe(false)
  })
})
```

- [ ] **Step 1.2: Run to confirm failure**

```
cd C:\Users\MosesBass\Desktop\REPOS\maestro-js
npx vitest run src/model/__tests__/Measure.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `Measure` constructor does not accept third arg, `isPickup` not defined.

- [ ] **Step 1.3: Implement — update `Measure.ts`**

Open `src/model/Measure.ts`. Replace the entire file with:

```typescript
import { type DurationName, BEAT_EPSILON } from './types.js'
import { DURATION_BEATS } from './Duration.js'
import { Note } from './Note.js'

export interface TimeSignature {
  beats: number
  noteValue: DurationName
}

export class Measure {
  readonly timeSignature: TimeSignature
  readonly rehearsalMark: string | null
  readonly isPickup: boolean
  private notes: Note[]
  private _usedBeats: number = 0

  constructor(
    timeSignature: TimeSignature,
    rehearsalMark: string | null = null,
    isPickup: boolean = false,
  ) {
    this.timeSignature = timeSignature
    this.rehearsalMark = rehearsalMark
    this.isPickup = isPickup
    this.notes = []
  }

  private get capacityBeats(): number {
    const noteBeats = DURATION_BEATS[this.timeSignature.noteValue]
    return this.timeSignature.beats * noteBeats
  }

  get totalBeats(): number {
    return this._usedBeats
  }

  get beatsRemaining(): number {
    return this.capacityBeats - this._usedBeats
  }

  get isFull(): boolean {
    if (this.isPickup) return false
    return this.beatsRemaining <= BEAT_EPSILON
  }

  addNote(note: Note, advanceTime: boolean = true): void {
    if (advanceTime && !this.isPickup && note.beats > this.beatsRemaining + BEAT_EPSILON) {
      throw new Error(
        `Note (${note.beats} beats) would overflow measure ` +
          `(${this.beatsRemaining} beats remaining)`,
      )
    }
    this.notes.push(note)
    if (advanceTime) {
      this._usedBeats += note.beats
    }
  }

  getNotes(): readonly Note[] {
    return this.notes
  }
}
```

- [ ] **Step 1.4: Run tests**

```
npx vitest run src/model/__tests__/Measure.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 1.5: Commit**

```
git add src/model/Measure.ts src/model/__tests__/Measure.test.ts
git commit -m "feat(model): add isPickup flag to Measure"
```

---

## Task 2: Auto-detect pickup measure in `VoiceModel`

**Files:**
- Modify: `src/model/VoiceModel.ts`
- Modify: `src/model/__tests__/VoiceModel.test.ts`

- [ ] **Step 2.1: Write failing tests**

Find `src/model/__tests__/VoiceModel.test.ts`. Add at the bottom:

```typescript
describe('VoiceModel pickup measure detection', () => {
  it('first measure is a pickup when first note does not fill the bar', () => {
    const vm = new VoiceModel('soprano', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }
    const note = new Note({
      pitch: 'E', accidental: null, octave: 4, duration: 'q', dotted: false,
      dynamic: null, tied: false, slurred: false, chord: false,
      fermata: false, breath: false, triplet: false,
    })
    vm.addNote(note, ts, true) // isFirstNote = true
    expect(vm.getMeasures()[0].isPickup).toBe(true)
    expect(vm.getMeasures()).toHaveLength(1)
  })

  it('first measure is NOT a pickup when first note fills the bar', () => {
    const vm = new VoiceModel('soprano', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }
    // Add 4 quarter notes — fills 4/4
    for (let i = 0; i < 4; i++) {
      const note = new Note({
        pitch: 'C', accidental: null, octave: 4, duration: 'q', dotted: false,
        dynamic: null, tied: false, slurred: false, chord: false,
        fermata: false, breath: false, triplet: false,
      })
      vm.addNote(note, ts, i === 0)
    }
    expect(vm.getMeasures()[0].isPickup).toBe(false)
  })

  it('pickup measure followed by full measures', () => {
    const vm = new VoiceModel('soprano', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }
    // 1 pickup note
    vm.addNote(new Note({
      pitch: 'E', accidental: null, octave: 4, duration: 'q', dotted: false,
      dynamic: null, tied: false, slurred: false, chord: false,
      fermata: false, breath: false, triplet: false,
    }), ts, true)
    // Force close the pickup (mark it done)
    vm.closePickupMeasure()
    // Add 4 full quarter notes
    for (let i = 0; i < 4; i++) {
      vm.addNote(new Note({
        pitch: 'C', accidental: null, octave: 4, duration: 'q', dotted: false,
        dynamic: null, tied: false, slurred: false, chord: false,
        fermata: false, breath: false, triplet: false,
      }), ts, false)
    }
    expect(vm.getMeasures()).toHaveLength(2)
    expect(vm.getMeasures()[0].isPickup).toBe(true)
    expect(vm.getMeasures()[1].isPickup).toBe(false)
  })
})
```

- [ ] **Step 2.2: Run to confirm failure**

```
npx vitest run src/model/__tests__/VoiceModel.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `addNote` does not accept third `isFirstNote` arg; `closePickupMeasure` not defined.

- [ ] **Step 2.3: Implement — update `VoiceModel.ts`**

Open `src/model/VoiceModel.ts`. Make the following targeted changes:

**a)** Add a private field `_pickupClosed = false` after `_pendingRehearsalMark`:

```typescript
private _pickupClosed: boolean = false
```

**b)** Change the signature of `addNote` to accept an optional third parameter:

```typescript
addNote(note: Note, timeSignature: TimeSignature, isFirstNote: boolean = false): void {
```

**c)** Add pickup detection at the very top of `addNote`, before the chord check:

```typescript
// Pickup detection: if this is the very first note and it's a rest-note that
// doesn't fill the bar, mark the about-to-be-created measure as pickup.
// We detect this by checking: no measures yet AND isFirstNote flag set.
const isFirstMeasure = this.measures.length === 0
```

**d)** Where the measure is first created (inside `addNote`, the `!current || current.isFull` block), update it:

```typescript
if (!current || current.isFull) {
  const mark = this._pendingRehearsalMark
  this._pendingRehearsalMark = null
  const makePickup = isFirstMeasure && isFirstNote && !this._pickupClosed
  current = new Measure(timeSignature, mark, makePickup)
  this.measures.push(current)
  this._currentChordGroup = -1
}
```

Same change applies in `splitNoteAcrossMeasures` — but there, pickup never applies (pickup cannot overflow), so pass `false` for the third arg of `new Measure(...)`.

**e)** Add the `closePickupMeasure` method:

```typescript
closePickupMeasure(): void {
  this._pickupClosed = true
  const first = this.measures[0]
  if (first?.isPickup) {
    // Nothing to do — just prevents further notes from going into a new pickup
  }
}
```

- [ ] **Step 2.4: Run tests**

```
npx vitest run src/model/__tests__/VoiceModel.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 2.5: Run full suite to check no regressions**

```
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 2.6: Commit**

```
git add src/model/VoiceModel.ts src/model/__tests__/VoiceModel.test.ts
git commit -m "feat(model): auto-detect pickup measure in VoiceModel"
```

---

## Task 3: Wire pickup through the converter and `Song` API

**Files:**
- Modify: `src/model/converter.ts` (the file at this path, based on Song.ts import of `nodeToNote`)
- Modify: `src/api/Song.ts`

- [ ] **Step 3.1: Update `buildScore` in `src/model/converter.ts`**

The call site is `src/model/converter.ts` line 58. Open the file and replace the loop:

```typescript
// BEFORE (lines 48–59):
for (const node of nodes) {
  if (node.isBarline) {
    if (node.rehearsalMark) {
      voice.setPendingRehearsalMark(node.rehearsalMark)
    }
    continue
  }
  const note = nodeToNote(node)
  voice.addNote(note, score.timeSignature)
}

// AFTER — pass isFirstNote for first non-barline note:
let firstNote = true
for (const node of nodes) {
  if (node.isBarline) {
    if (node.rehearsalMark) {
      voice.setPendingRehearsalMark(node.rehearsalMark)
    }
    continue
  }
  // Pass multiMeasureRest through nodeToNote (added in Task 6)
  const note = nodeToNote(node)
  voice.addNote(note, score.timeSignature, firstNote)
  firstNote = false
}
```

Also update `nodeToNote` in the same file to forward `multiMeasureRest` (needed for Task 6 — add it now even if the field doesn't exist yet, it will be added in Task 6):

```typescript
export function nodeToNote(node: NoteNode): Note {
  const noteData: NoteData = {
    pitch: node.pitch ?? 'R',
    accidental: node.accidental,
    octave: node.octave ?? 4,
    duration: node.duration,
    dotted: node.dotted,
    dynamic: node.dynamic,
    tied: node.tied,
    slurred: node.slurred,
    chord: node.chord,
    chordGroup: node.chordGroup,
    fermata: node.fermata,
    breath: node.breath,
    triplet: node.triplet,
    tupletRatio: node.tupletRatio,
    lyric: node.lyric,
    articulation: node.articulation,
    ornament: node.ornament,
    graceNote: node.graceNote,
    chordSymbol: node.chordSymbol,
    glissando: node.glissando,
    expression: node.expression,
    multiMeasureRest: node.multiMeasureRest,  // added for multi-measure rest support
  }
  return new Note(noteData)
}
```

- [ ] **Step 3.3: Add `Song.setPickup(true)` method**

Open `src/api/Song.ts`. Add this method to the `Song` class (near other configuration methods):

```typescript
setPickup(enabled: boolean): this {
  this.score.setPickup(enabled)
  return this
}
```

Then open `src/model/Score.ts` and add:

```typescript
private _hasPickup: boolean = false

setPickup(enabled: boolean): void {
  this._hasPickup = enabled
}

get hasPickup(): boolean {
  return this._hasPickup
}
```

- [ ] **Step 3.4: Run full test suite**

```
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 3.5: Commit**

```
git add src/model/converter.ts src/api/Song.ts src/model/Score.ts
git commit -m "feat(api): wire pickup through converter and Song API"
```

---

## Task 4: Render pickup measure in VexFlowAdapter

**Files:**
- Modify: `src/adapters/renderer/VexFlowAdapter.ts`

No unit tests for rendering (VexFlow is visual). Manual verification instead.

- [ ] **Step 4.1: Find where staves are created in VexFlowAdapter**

Read `src/adapters/renderer/VexFlowAdapter.ts` fully. Find the function `renderSystemLine` (or equivalent) and the section where a `Stave` is constructed for each measure.

- [ ] **Step 4.2: Remove left barline from pickup stave**

Locate where `new Stave(x, y, width)` is called per measure. Add this block immediately after stave construction, checking if the measure is the first and is a pickup:

```typescript
// Pickup measure: hide the opening barline
if (measureIndex === 0 && measure.isPickup) {
  stave.setBegBarType(Barline.type.NONE)
}
```

Import `Barline` from vexflow if not already imported (check line 1–20 of the file — it's already imported).

- [ ] **Step 4.3: Narrow pickup stave width**

Pickup measures should be narrower. Where the stave width is computed, add:

```typescript
const staveWidth = measure.isPickup
  ? Math.max(60, measure.totalBeats * 40)  // narrow: ~40px per beat
  : computedWidth
```

Replace `computedWidth` with whatever variable currently holds the per-stave width calculation.

- [ ] **Step 4.4: Manual verification**

Create a temporary test file `examples/pickup-test.html` (or add to an existing example) that renders a pickup measure. Run the dev server or open in browser. Confirm:
- First measure has no left barline
- First measure is narrower than subsequent measures
- Notes in pickup measure render correctly

Delete the temp test file after verifying.

- [ ] **Step 4.5: Commit**

```
git add src/adapters/renderer/VexFlowAdapter.ts
git commit -m "feat(renderer): render pickup measure without left barline"
```

---

## Task 5: Pickup scheduling in Scheduler

**Files:**
- Modify: `src/scheduler/Scheduler.ts`
- Create: `src/scheduler/__tests__/Scheduler.pickup.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `src/scheduler/__tests__/Scheduler.pickup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Score } from '../../model/Score.js'
import { Scheduler } from '../Scheduler.js'

function makePickupScore(): Score {
  const score = new Score({ tempo: 60, timeSignature: '4/4' })
  score.setPickup(true)
  const part = score.addPart('Piano')
  const voice = part.addVoice('right', 'treble')
  const ts = { beats: 4, noteValue: 'q' as const }

  // Simulate: pickup quarter note, then 4 quarters
  // In real usage the parser does this, but here we add notes directly
  // pickup note
  voice.addNote(makeNote('E', 4, 'q'), ts, true)
  voice.closePickupMeasure()
  // full measure
  for (let i = 0; i < 4; i++) {
    voice.addNote(makeNote('C', 4, 'q'), ts, false)
  }
  return score
}

function makeNote(pitch: string, octave: number, duration: string) {
  const { Note } = require('../../model/Note.js')
  const { DurationName } = require('../../model/types.js')
  return new Note({
    pitch, accidental: null, octave, duration, dotted: false,
    dynamic: null, tied: false, slurred: false, chord: false,
    fermata: false, breath: false, triplet: false,
  })
}

describe('Scheduler pickup measure', () => {
  it('first event starts at time 0', () => {
    const score = makePickupScore()
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].time).toBeCloseTo(0)
  })

  it('pickup note duration matches quarter note at 60bpm (1 second)', () => {
    const score = makePickupScore()
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.duration).toBeCloseTo(1.0)
  })

  it('second measure notes start after pickup duration', () => {
    const score = makePickupScore()
    const timeline = Scheduler.buildTimeline(score)
    // pickup = 1 beat = 1s at 60bpm; full measure notes start at t=1
    expect(timeline[1].time).toBeCloseTo(1.0)
  })

  it('pickup measure number is 1, full measures start at 2', () => {
    const score = makePickupScore()
    const timeline = Scheduler.buildTimeline(score)
    expect(timeline[0].note.measure).toBe(1)
    expect(timeline[1].note.measure).toBe(2)
  })
})
```

- [ ] **Step 5.2: Run to confirm failure**

```
npx vitest run src/scheduler/__tests__/Scheduler.pickup.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `Score` doesn't have `setPickup` yet wired to scheduler behavior, and `VoiceModel` doesn't have `closePickupMeasure` in `Part.addVoice` return value.

- [ ] **Step 5.3: Implement — pickup is already correct in Scheduler**

The `Scheduler.buildTimeline` already iterates measures sequentially. Pickup is just measure index 0 with fewer beats. Since `Measure.totalBeats` returns actual beats used, the measure duration calculation at the end of the inner loop is:

```typescript
measureStartTime += beatsToSeconds(localBeat, tempo)
```

This already works correctly — pickup measure will contribute `beatsToSeconds(1, 60) = 1s` and the next measure will start at `t=1`. No change needed in Scheduler.

- [ ] **Step 5.4: Fix the test to use proper API**

The test above uses `require()` which won't work in ESM. Rewrite the helper function using static imports:

```typescript
import { describe, it, expect } from 'vitest'
import { Score } from '../../model/Score.js'
import { Note } from '../../model/Note.js'
import { Scheduler } from '../Scheduler.js'
import type { TimeSignature } from '../../model/Measure.js'

function n(pitch: string, octave: number, duration: 'q' | 'h' | 'w' | 'e' | 's') {
  return new Note({
    pitch: pitch as any, accidental: null, octave: octave as any, duration, dotted: false,
    dynamic: null, tied: false, slurred: false, chord: false,
    fermata: false, breath: false, triplet: false,
  })
}

describe('Scheduler pickup measure', () => {
  it('pickup note plays at time 0 and full measure notes follow', () => {
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    score.setPickup(true)
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    voice.addNote(n('E', 4, 'q'), ts, true)
    voice.closePickupMeasure()
    for (let i = 0; i < 4; i++) {
      voice.addNote(n('C', 4, 'q'), ts, false)
    }

    const timeline = Scheduler.buildTimeline(score)
    // pickup note at t=0
    expect(timeline[0].time).toBeCloseTo(0)
    expect(timeline[0].note.duration).toBeCloseTo(1.0)
    // first full-measure note starts at t=1 (after 1 beat pickup)
    expect(timeline[1].time).toBeCloseTo(1.0)
  })
})
```

- [ ] **Step 5.5: Run tests**

```
npx vitest run src/scheduler/__tests__/Scheduler.pickup.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5.6: Run full suite**

```
npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 5.7: Commit**

```
git add src/scheduler/__tests__/Scheduler.pickup.test.ts
git commit -m "test(scheduler): verify pickup measure timing"
```

---

## Task 6: Multi-measure rest — model + parser

**Files:**
- Modify: `src/model/types.ts`
- Modify: `src/model/Note.ts`
- Modify: `src/parser/parser.ts`
- Create: `src/parser/__tests__/parser.multimeasurerest.test.ts`

- [ ] **Step 6.1: Write failing parser tests**

Create `src/parser/__tests__/parser.multimeasurerest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'

describe('Multi-measure rest parsing', () => {
  it('parses R:2m as a multi-measure rest of 2 bars', () => {
    const nodes = parse('R:2m')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('rest')
    expect(nodes[0].multiMeasureRest).toBe(2)
  })

  it('parses R:4m as a multi-measure rest of 4 bars', () => {
    const nodes = parse('R:4m')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].multiMeasureRest).toBe(4)
  })

  it('parses R:1m as single-measure rest shorthand', () => {
    const nodes = parse('R:1m')
    expect(nodes[0].multiMeasureRest).toBe(1)
  })

  it('regular R:q is NOT a multi-measure rest', () => {
    const nodes = parse('R:q')
    expect(nodes[0].multiMeasureRest).toBeUndefined()
  })

  it('multi-measure rest can appear among other notes', () => {
    const nodes = parse('C4:q R:2m D4:q')
    expect(nodes).toHaveLength(3)
    expect(nodes[1].multiMeasureRest).toBe(2)
  })
})
```

- [ ] **Step 6.2: Run to confirm failure**

```
npx vitest run src/parser/__tests__/parser.multimeasurerest.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `multiMeasureRest` not in `NoteNode`.

- [ ] **Step 6.3: Add `multiMeasureRest` to types**

Open `src/parser/types.ts` (or wherever `NoteNode` is defined — check imports in `parser.ts`). Find the `NoteNode` interface and add:

```typescript
multiMeasureRest?: number  // number of measures; only set when this is an R:Nm token
```

Also open `src/model/types.ts`. Find `NoteData` interface and add:

```typescript
multiMeasureRest?: number
```

- [ ] **Step 6.4: Update `Note.ts` to carry `multiMeasureRest`**

Open `src/model/Note.ts`. Add to the class:

```typescript
readonly multiMeasureRest: number | undefined
```

In the constructor, add:

```typescript
this.multiMeasureRest = data.multiMeasureRest
```

- [ ] **Step 6.5: Update `parser.ts` to detect `R:Nm` tokens**

Open `src/parser/parser.ts`. Find the function `parseNoteRaw` (around line 37 of the file). The regex there is:

```
/^([A-GR])(##|bb|#|b)?([0-8])?(?::([whqest])(\.)?)?(?:\(([^)]+)\))?(?:\(([^)]+)\))?(?:"([^"]*)")?$/
```

This does not match `R:2m`. Before this regex is applied, add an early-exit branch:

```typescript
// Multi-measure rest: R:Nm where N is a positive integer
const multiRestMatch = raw.match(/^R:(\d+)m$/)
if (multiRestMatch) {
  const count = parseInt(multiRestMatch[1], 10)
  return {
    type: 'rest',
    pitch: null,
    accidental: null,
    octave: null,
    duration: 'w',  // placeholder duration (the multi-rest spans N full measures)
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    isBarline: false,
    chord: false,
    triplet: false,
    fermata: false,
    breath: false,
    articulation: null,
    ornament: null,
    multiMeasureRest: count,
  }
}
```

Place this before the existing regex match inside `parseNoteRaw`.

- [ ] **Step 6.6: Run parser tests**

```
npx vitest run src/parser/__tests__/parser.multimeasurerest.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6.7: Run full suite**

```
npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6.8: Commit**

```
git add src/model/types.ts src/model/Note.ts src/parser/parser.ts src/parser/__tests__/parser.multimeasurerest.test.ts
git commit -m "feat(parser): add R:Nm multi-measure rest token"
```

---

## Task 7: Multi-measure rest — VexFlow rendering

**Files:**
- Modify: `src/adapters/renderer/VexFlowAdapter.ts`

- [ ] **Step 7.1: Find the note rendering loop in VexFlowAdapter**

Read `src/adapters/renderer/VexFlowAdapter.ts` fully. Find where `StaveNote` objects are created per measure (look for `groupNotesForRender` and `createVexStaveNotes`). This is where multi-measure rests need special-casing.

- [ ] **Step 7.2: Add VexFlow import for `StaveMultiMeasureRest`**

VexFlow 5 exports `StaveMultiMeasureRest`. Add it to the import at the top of `VexFlowAdapter.ts`:

```typescript
import {
  // ... existing imports ...
  StaveMultiMeasureRest,
} from 'vexflow'
```

Verify this export exists:

```
grep -r "StaveMultiMeasureRest" C:\Users\MosesBass\Desktop\REPOS\maestro-js\node_modules\vexflow\build --include="*.d.ts" -l
```

If not found, VexFlow 5 may use a different name. Check:

```
grep -r "MultiMeasure" C:\Users\MosesBass\Desktop\REPOS\maestro-js\node_modules\vexflow\build --include="*.d.ts" | head -10
```

Use whichever name VexFlow exports.

- [ ] **Step 7.3: Skip normal note rendering for multi-measure rests**

In the measure rendering loop, before creating `VexVoice` and notes, check if the measure contains exactly one note with `multiMeasureRest > 0`:

```typescript
const notes = measure.getNotes()
const singleMultiRest = notes.length === 1 && notes[0].multiMeasureRest != null
  ? notes[0].multiMeasureRest
  : null

if (singleMultiRest != null) {
  // Render compact multi-measure rest symbol
  const mmRest = new StaveMultiMeasureRest(singleMultiRest, {
    number_of_measures: singleMultiRest,
  })
  mmRest.setContext(context).setStave(stave).draw()
  continue  // skip normal note layout for this measure
}
```

Adjust variable names (`measure`, `context`, `stave`) to match the actual variable names used in the rendering function.

- [ ] **Step 7.4: Manual verification**

Add a voice with `R:4m` to an example or write a quick manual test in the examples folder. Verify the multi-measure rest symbol renders correctly. Delete the manual test file after.

- [ ] **Step 7.5: Commit**

```
git add src/adapters/renderer/VexFlowAdapter.ts
git commit -m "feat(renderer): render multi-measure rests with StaveMultiMeasureRest"
```

---

## Task 8: Multi-measure rest — Scheduler skips silent measures

**Files:**
- Modify: `src/scheduler/Scheduler.ts`
- Modify: `src/scheduler/__tests__/Scheduler.pickup.test.ts` (add multi-rest tests)

- [ ] **Step 8.1: Write failing tests**

Add to `src/scheduler/__tests__/Scheduler.pickup.test.ts`:

```typescript
describe('Scheduler multi-measure rest', () => {
  it('multi-measure rest contributes correct duration to timeline', () => {
    // At 60bpm, 4/4: each measure = 4 beats = 4 seconds
    // R:2m should contribute 8 seconds of silence
    const score = new Score({ tempo: 60, timeSignature: '4/4' })
    const part = score.addPart('Piano')
    const voice = part.addVoice('right', 'treble')
    const ts: TimeSignature = { beats: 4, noteValue: 'q' }

    // R:2m = 2 measures of rest (not emitted as note events)
    voice.addNote(new Note({
      pitch: 'R', accidental: null, octave: 4 as any, duration: 'w', dotted: false,
      dynamic: null, tied: false, slurred: false, chord: false,
      fermata: false, breath: false, triplet: false,
      multiMeasureRest: 2,
    }), ts, true)

    // Note after the rest
    voice.addNote(n('C', 4, 'q'), ts, false)

    const timeline = Scheduler.buildTimeline(score)
    // The multi-measure rest should NOT produce a note event (it's a rest)
    // The note after should start at t=8 (2 measures × 4 beats × 1s/beat)
    const nonRestEvents = timeline.filter(e => e.note.pitch !== null)
    expect(nonRestEvents[0].time).toBeCloseTo(8.0)
  })
})
```

- [ ] **Step 8.2: Run to confirm failure**

```
npx vitest run src/scheduler/__tests__/Scheduler.pickup.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — multi-measure rest note is treated as a regular rest spanning 4 beats, not N measures.

- [ ] **Step 8.3: Implement — handle multi-measure rest in buildTimeline**

Open `src/scheduler/Scheduler.ts`. Inside `buildTimeline`, in the inner `for (const note of measure.getNotes())` loop, add at the very top:

```typescript
// Multi-measure rest: advance time by N full measures, emit no note events
if (note.multiMeasureRest != null) {
  const fullMeasureBeats = measure.timeSignature.beats *
    (DURATION_BEATS[measure.timeSignature.noteValue as DurationName] ?? 1)
  const restDuration = beatsToSeconds(fullMeasureBeats * note.multiMeasureRest, tempo)
  measureStartTime += restDuration
  // Skip all other processing for this note
  continue
}
```

Note: `measure` must be in scope — verify the variable name in the actual loop.

Also import `DURATION_BEATS` from `'../model/Duration.js'` at the top of Scheduler.ts if not already imported.

- [ ] **Step 8.4: Run tests**

```
npx vitest run src/scheduler/__tests__/Scheduler.pickup.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 8.5: Run full suite**

```
npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 8.6: Commit**

```
git add src/scheduler/Scheduler.ts src/scheduler/__tests__/Scheduler.pickup.test.ts
git commit -m "feat(scheduler): skip multi-measure rests in timeline"
```

---

## Task 9: Precise timing callbacks — `TimingCallbacks` class

**Files:**
- Modify: `src/scheduler/timeline.ts`
- Create: `src/scheduler/TimingCallbacks.ts`
- Create: `src/scheduler/__tests__/TimingCallbacks.test.ts`
- Modify: `src/api/Song.ts`

- [ ] **Step 9.1: Add `NoteTimingEvent` to timeline.ts**

Open `src/scheduler/timeline.ts`. Add at the bottom:

```typescript
export interface NoteTimingEvent {
  measureIndex: number   // 0-based
  beatIndex: number      // 0-based beat within measure
  noteIndex: number      // 0-based index in timeline
  time: number           // absolute time in seconds (audio context clock)
  duration: number       // note duration in seconds
  pitches: Array<string | null>  // pitch strings, e.g. ['C4', 'E4'] for chord; [null] for rest
  voice: string
}

export interface TimingCallbackOptions {
  onNote?: (event: NoteTimingEvent) => void
  onBeat?: (measure: number, beat: number) => void
  onMeasure?: (measure: number) => void
  onEnd?: () => void
}
```

- [ ] **Step 9.2: Write failing tests for TimingCallbacks**

Create `src/scheduler/__tests__/TimingCallbacks.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { TimingCallbacks } from '../TimingCallbacks.js'
import type { Timeline } from '../timeline.js'

function makeTimeline(): Timeline {
  return [
    {
      time: 0,
      note: { pitch: 'C4', midi: 60, frequency: 261.63, duration: 1.0, velocity: 64,
               dynamic: null, voice: 'right', measure: 1, beat: 0, tied: false, chord: false }
    },
    {
      time: 1.0,
      note: { pitch: 'E4', midi: 64, frequency: 329.63, duration: 1.0, velocity: 64,
               dynamic: null, voice: 'right', measure: 1, beat: 1, tied: false, chord: false }
    },
    {
      time: 2.0,
      note: { pitch: 'G4', midi: 67, frequency: 392.0, duration: 2.0, velocity: 64,
               dynamic: null, voice: 'right', measure: 2, beat: 0, tied: false, chord: false }
    },
  ]
}

describe('TimingCallbacks', () => {
  it('constructs without error', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc).toBeDefined()
  })

  it('getNoteAt returns correct event for a given time', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const event = tc.getNoteAt(0.5)
    expect(event?.pitches[0]).toBe('C4')
  })

  it('getNoteAt returns null before first note', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc.getNoteAt(-0.1)).toBeNull()
  })

  it('getNoteAt returns event for second note', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const event = tc.getNoteAt(1.5)
    expect(event?.pitches[0]).toBe('E4')
  })

  it('getProgress returns 0 at start', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    expect(tc.getProgress(0)).toBeCloseTo(0)
  })

  it('getProgress returns 1 at end', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const endTime = 2.0 + 2.0  // last note time + duration
    expect(tc.getProgress(endTime)).toBeCloseTo(1)
  })

  it('buildNoteEvents maps timeline to NoteTimingEvents', () => {
    const tc = new TimingCallbacks(makeTimeline(), {})
    const events = tc.buildNoteEvents()
    expect(events).toHaveLength(3)
    expect(events[0].measureIndex).toBe(0)  // 0-based
    expect(events[0].pitches).toEqual(['C4'])
    expect(events[2].measureIndex).toBe(1)
  })
})
```

- [ ] **Step 9.3: Run to confirm failure**

```
npx vitest run src/scheduler/__tests__/TimingCallbacks.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `TimingCallbacks` doesn't exist.

- [ ] **Step 9.4: Implement `TimingCallbacks.ts`**

Create `src/scheduler/TimingCallbacks.ts`:

```typescript
import type { Timeline, NoteTimingEvent, TimingCallbackOptions } from './timeline.js'

/**
 * TimingCallbacks: given a pre-built Timeline, allows callers to:
 * - Query which note is playing at a given audio-clock time
 * - Get overall playback progress (0–1)
 * - Build a flat array of NoteTimingEvents for animation use
 *
 * This class is pure data — it holds no Tone.js or Web Audio references.
 * The ToneAdapter is responsible for calling onNote/onBeat/onMeasure at
 * the correct audio-clock times using Tone.Draw.
 */
export class TimingCallbacks {
  private readonly timeline: Timeline
  private readonly callbacks: TimingCallbackOptions
  private readonly totalDuration: number

  constructor(timeline: Timeline, callbacks: TimingCallbackOptions) {
    this.timeline = timeline
    this.callbacks = callbacks
    this.totalDuration = timeline.length > 0
      ? timeline[timeline.length - 1].time + timeline[timeline.length - 1].note.duration
      : 0
  }

  /**
   * Build a flat array of NoteTimingEvents from the timeline.
   * Returned array is sorted by time ascending.
   */
  buildNoteEvents(): NoteTimingEvent[] {
    let currentMeasure = -1
    let beatWithinMeasure = 0
    let prevMeasure = -1

    return this.timeline.map((ev, idx) => {
      const measureIndex = ev.note.measure - 1  // convert 1-based to 0-based
      if (measureIndex !== prevMeasure) {
        beatWithinMeasure = 0
        prevMeasure = measureIndex
      }
      const event: NoteTimingEvent = {
        measureIndex,
        beatIndex: beatWithinMeasure,
        noteIndex: idx,
        time: ev.time,
        duration: ev.note.duration,
        pitches: [ev.note.pitch],
        voice: ev.note.voice,
      }
      if (!ev.note.chord) {
        beatWithinMeasure++
      }
      return event
    })
  }

  /**
   * Get the NoteTimingEvent active at the given audio time, or null if before first note.
   */
  getNoteAt(audioTime: number): NoteTimingEvent | null {
    const events = this.buildNoteEvents()
    let result: NoteTimingEvent | null = null
    for (const ev of events) {
      if (ev.time <= audioTime && audioTime < ev.time + ev.duration) {
        result = ev
        break
      }
    }
    return result
  }

  /**
   * Get playback progress as a fraction 0–1.
   */
  getProgress(audioTime: number): number {
    if (this.totalDuration === 0) return 0
    return Math.min(1, Math.max(0, audioTime / this.totalDuration))
  }

  get options(): TimingCallbackOptions {
    return this.callbacks
  }

  get duration(): number {
    return this.totalDuration
  }
}
```

- [ ] **Step 9.5: Run tests**

```
npx vitest run src/scheduler/__tests__/TimingCallbacks.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 9.6: Run full suite**

```
npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 9.7: Commit**

```
git add src/scheduler/timeline.ts src/scheduler/TimingCallbacks.ts src/scheduler/__tests__/TimingCallbacks.test.ts
git commit -m "feat(scheduler): add TimingCallbacks class with NoteTimingEvent"
```

---

## Task 10: Wire precise callbacks into ToneAdapter

**Files:**
- Modify: `src/adapters/audio/ToneAdapter.ts`

No unit tests here (Tone.js requires browser audio context). Integration tested manually.

- [ ] **Step 10.1: Read ToneAdapter fully**

Read the complete `src/adapters/audio/ToneAdapter.ts`. Find:
1. Where `Tone.Transport.schedule` or `Tone.getDraw` is used
2. Where the `beat`, `note`, `measure` events are currently fired
3. The `play()` method that sets up scheduling

- [ ] **Step 10.2: Replace imprecise event firing with Tone.Draw**

Tone.js `Draw` schedules a callback synchronized to the audio clock, fired on the next animation frame after the audio event. This gives sub-10ms accuracy compared to JavaScript `setTimeout`.

In `ToneAdapter.ts`, wherever note events are currently scheduled (likely inside `Tone.Transport.schedule`), replace the event emission call:

```typescript
// BEFORE (imprecise):
this.emit('note', { pitch, measure, beat })

// AFTER (audio-clock accurate via Tone.Draw):
import * as Tone from 'tone'

Tone.getDraw().schedule(() => {
  this.emit('note', { pitch, measure, beat, time: Tone.getContext().currentTime })
}, time)
```

Where `time` is the absolute transport time of the note event.

- [ ] **Step 10.3: Add `TimingCallbacks` support to ToneAdapter**

Open `ToneAdapter.ts`. Add an import:

```typescript
import { TimingCallbacks } from '../../scheduler/TimingCallbacks.js'
import type { TimingCallbackOptions } from '../../scheduler/timeline.js'
```

Add a private field:

```typescript
private timingCallbacks: TimingCallbacks | null = null
```

Add a method `setTimingCallbacks`:

```typescript
setTimingCallbacks(callbacks: TimingCallbackOptions): void {
  const tc = new TimingCallbacks(this.timeline, callbacks)
  this.timingCallbacks = tc

  // Schedule onNote for each timeline event using Tone.Draw
  for (const ev of tc.buildNoteEvents()) {
    const transportTime = ev.time  // timeline times are in seconds from start
    Tone.getDraw().schedule(() => {
      callbacks.onNote?.(ev)
    }, transportTime)

    if (ev.beatIndex === 0) {
      Tone.getDraw().schedule(() => {
        callbacks.onMeasure?.(ev.measureIndex)
      }, transportTime)
    }

    Tone.getDraw().schedule(() => {
      callbacks.onBeat?.(ev.measureIndex, ev.beatIndex)
    }, transportTime)
  }
}
```

- [ ] **Step 10.4: Expose `TimingCallbacks` through `Song` API**

Open `src/api/Song.ts`. Add import:

```typescript
import { TimingCallbacks } from '../scheduler/TimingCallbacks.js'
import type { TimingCallbackOptions } from '../scheduler/timeline.js'
```

Add method to `Song` class:

```typescript
createTimingCallbacks(options: TimingCallbackOptions): TimingCallbacks {
  const adapter = this.audioAdapter
  if (adapter) {
    adapter.setTimingCallbacks(options)
  }
  // Return a TimingCallbacks instance for direct use (e.g. cursor animation)
  const timeline = Scheduler.buildTimeline(this.score)
  return new TimingCallbacks(Scheduler.mergeTies(timeline), options)
}
```

- [ ] **Step 10.5: Export TimingCallbacks from package index**

Open `src/index.ts` (browser entry point). Add:

```typescript
export { TimingCallbacks } from './scheduler/TimingCallbacks.js'
export type { NoteTimingEvent, TimingCallbackOptions } from './scheduler/timeline.js'
```

- [ ] **Step 10.6: Run full suite + typecheck**

```
npx vitest run 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -30
```

Expected: all tests pass, no type errors.

- [ ] **Step 10.7: Commit**

```
git add src/adapters/audio/ToneAdapter.ts src/api/Song.ts src/index.ts
git commit -m "feat(audio): wire TimingCallbacks into ToneAdapter with Tone.Draw precision"
```

---

## Task 11: Final integration check

- [ ] **Step 11.1: Run full test suite**

```
npx vitest run --reporter=verbose 2>&1 | tail -40
```

Expected: all pass, coverage thresholds met.

- [ ] **Step 11.2: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11.3: Build**

```
npm run build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 11.4: Final commit**

```
git add -A
git commit -m "feat: Phase 1 complete — pickup measures, multi-measure rests, timing callbacks"
```

---

## Verification Checklist

- [ ] Pickup measure: renders without left barline, narrower width
- [ ] Pickup measure: `Song.setPickup(true)` works in API
- [ ] Pickup scheduling: events start at `t=0`, full measure notes follow pickup duration
- [ ] `R:2m` parses to `multiMeasureRest: 2` in parser output
- [ ] Multi-measure rest: VexFlow renders `StaveMultiMeasureRest` symbol
- [ ] Multi-measure rest: Scheduler skips N×measure-duration of time, no note events emitted
- [ ] `TimingCallbacks.getNoteAt(t)` returns correct note for any audio time
- [ ] `TimingCallbacks.getProgress(t)` returns 0–1 fraction
- [ ] `ToneAdapter` fires `onNote` callbacks via `Tone.Draw` (audio-clock accurate)
- [ ] `Song.createTimingCallbacks(options)` returns `TimingCallbacks` instance
- [ ] `TimingCallbacks` and `NoteTimingEvent` exported from package index
- [ ] All existing tests still pass
- [ ] TypeScript: `tsc --noEmit` clean
- [ ] Build: `npm run build` succeeds
