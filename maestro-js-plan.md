# Maestro.js — Build Plan
### From Zero to Published npm Package

---

## What This Document Is

This is the complete execution plan for building **Maestro.js** — a human-friendly JavaScript library that lets songwriters, composers, and choirmasters write music with simple syntax, render it as sheet music, and play it back as audio. This document covers architecture, development phases, API design, testing strategy, publishing, and what the finished product looks and feels like.

---

## The North Star

Before any code is written, every decision should be measured against this principle:

> **A grandmother and a conservatory-trained choirmaster should both be able to use Maestro.js without reading more than one page of documentation.**

The grandmother writes a single melody. The choirmaster writes a full SATB choral arrangement with dynamics, triplets, and expression marks. Both experiences feel natural and unsurprising.

---

## Finished Product: What It Looks Like

### Installation

```bash
npm install maestro-js
```

That's it. No peer dependencies to configure. VexFlow and Tone.js are bundled internally.

---

### The Simplest Possible Usage

```js
import { Song } from 'maestro-js'

const song = new Song()
song.add('C4 D4 E4 F4 G4')
song.render('#sheet')
song.play()
```

Three lines after import. A child can do this. It renders a sheet music staff into any HTML element and plays the notes through the browser's audio system.

---

### A Real Song — Intermediate Usage

```js
import { Song } from 'maestro-js'

const song = new Song({
  tempo: 112,
  timeSignature: '4/4',
  key: 'D',
  instrument: 'piano'
})

// Verse melody with dynamics
song.add('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h | E4:q(mp) F#4:q G4:q F#4:q | D4:w(p)')

// Chorus with chords
song.add('[D4 F#4 A4]:h(f) [A4 C#5 E5]:h | [G4 B4 D5]:h(ff) [A4 C#5 E5]:h(mf)')

song.render('#sheet-container', {
  width: 800,
  theme: 'light',
  showDynamics: true
})

song.play()
```

---

### Full SATB Choir — Advanced Usage

```js
import { Song } from 'maestro-js'

const chorale = new Song({
  tempo: 76,
  timeSignature: '4/4',
  key: 'Bb',
  title: 'Sanctus',
  composer: 'Anonymous'
})

chorale.voice('soprano', { clef: 'treble' })
  .add('Bb4:h(mp) C5:q D5:q | Eb5:h D5:h | C5:q(mf) Bb4:q C5:h | Bb4:w(p)')

chorale.voice('alto', { clef: 'treble' })
  .add('F4:h G4:q F4:q | G4:h F4:h | Eb4:q(mf) F4:q Eb4:h | D4:w(p)')

chorale.voice('tenor', { clef: 'treble-8' })
  .add('D4:h Eb4:q F4:q | Bb4:h F4:h | G4:q(mf) F4:q G4:h | F4:w(p)')

chorale.voice('bass', { clef: 'bass' })
  .add('Bb2:h Eb3:q F3:q | Eb3:h Bb3:h | F3:q(mf) F2:q C3:h | Bb2:w(p)')

chorale.render('#score', { grandStaff: true, showBarNumbers: true })
chorale.play({ voices: ['soprano', 'alto'], solo: false })
```

---

### Triplets, Dotted Notes, Ties & Slurs

```js
// Triplet — 3 notes in the space of 1 quarter note
song.add('{C4 D4 E4}:q F4:q G4:h')

// Dotted note — dot after duration character
song.add('G4:h. E4:q')

// Tie — connect same pitch across barlines
song.add('C4:h~C4:h | C4:q D4:q E4:h')

// Slur — phrase marking over different pitches (rendered as curved line)
song.add('(E4:q F4:q G4:h)')

// Rest — use R
song.add('C4:q R:q E4:h')
```

---

### The Complete Note Syntax Reference

```
Pitch:     C D E F G A B   (natural)
Accidentals: C# Db D# Eb F# Gb G# Ab A# Bb
Octave:    C3 C4 C5 C6   (middle C = C4)

Duration:  :w  whole
           :h  half
           :q  quarter
           :e  eighth
           :s  sixteenth
           :t  thirty-second
           .   dot after duration — adds half the value (:h. = dotted half)

Rest:      R:q  (rest for one quarter note)

Chord:     [C4 E4 G4]:h     (all pitches in brackets share the duration)

Triplet:   {C4 D4 E4}:q     (3 notes squeezed into 1 quarter duration)

Dynamics:  (pp) (p) (mp) (mf) (f) (ff) (fff)
           (p<) = crescendo start   (f>) = decrescendo start

Tie:       C4:h~C4:h         (same pitch connected across beats/bars)

Slur:      (E4:q F4:q G4:h)  (phrase slur over different pitches)

Barline:   |   (separate measures)
```

---

### Events API — For App Integration

```js
// Sync UI to playback position
song.on('beat', ({ beat, measure, time }) => {
  highlightMeasure(measure)
})

song.on('note', ({ pitch, voice, duration, time }) => {
  flashKey(pitch)
})

song.on('end', () => {
  showReplayButton()
})

// Control playback
song.play()
song.pause()
song.stop()
song.seekTo({ measure: 3, beat: 1 })

// Export
const svg = song.exportSVG()
const midi = song.exportMIDI()     // Buffer
const json = song.exportJSON()     // Portable score format
```

---

### Node.js Usage (Server-side Rendering)

```js
// Node.js — no browser required
import { Song } from 'maestro-js/node'
import fs from 'fs'

const song = new Song({ tempo: 90 })
song.add('G4:q A4:q B4:q C5:q | D5:w')

const svg = song.exportSVG()
fs.writeFileSync('sheet.svg', svg)

// Render to PNG via sharp (optional peer dep)
const png = await song.exportPNG()
fs.writeFileSync('sheet.png', png)
```

---

## Architecture — The Three Layers

### Layer 1: User API (`Song`, `Voice`)

Everything the developer touches. Chainable, forgiving, well-typed. This layer never changes its public interface — it is the contract with the user. Design it once, design it carefully, and honor it forever.

**Principles:**
- Every method returns `this` for chaining
- Errors are human-readable: `"Unrecognized note 'H4'. Did you mean 'A4'?"`
- Sensible defaults for everything — tempo 120, 4/4, treble clef, piano
- Optional parameters are always truly optional

---

### Layer 2: Core Engine

Three internal modules that never touch the DOM or audio directly:

**Parser** — Converts the note string syntax into an Abstract Syntax Tree (AST). Input: `"C4:q D4:q E4:h"`. Output: a structured array of `NoteNode` objects with pitch, octave, duration, dynamics, articulation, and grouping metadata. The parser must be strict but generous with error messages.

**Score Model** — The internal representation of the music. A tree of `Score → Part → Voice → Measure → Beat → Note`. Handles the music theory: time signature enforcement, beat counting, tuplet math, key signature accidentals, multi-voice alignment. This is the source of truth. Both the renderer and the player consume this model — they never talk to each other directly.

**Playback Scheduler** — Converts the Score Model into a timeline of scheduled events with precise timestamps in seconds. Handles tempo changes, ritardando, fermatas, repeat signs. Works in both browser (using Tone.js Transport) and Node (offline rendering).

---

### Layer 3: Adapters

**Sheet Renderer** — Takes the Score Model and drives VexFlow to produce SVG output. Handles: staff layout, multi-staff grand staves, clef rendering, key/time signatures, beam grouping, slur curves, dynamic markings, barline styles, rehearsal marks, title/composer text.

**Audio Player** — Takes the Playback Scheduler timeline and drives Tone.js. Handles: instrument synthesis (piano, strings, choir, organ), dynamic shaping (velocity curves), articulation (staccato, legato), pedal sustain, polyphonic voice management.

Both adapters are swappable. If a user wants to swap Tone.js for Howler.js or a MIDI output, they implement the `AudioAdapter` interface and pass it in. The rest of the library doesn't care.

---

## Repository Structure

```
maestro-js/
├── src/
│   ├── api/
│   │   ├── Song.ts               # Main user-facing class
│   │   ├── Voice.ts              # Voice/part builder
│   │   └── index.ts
│   ├── parser/
│   │   ├── tokenizer.ts          # String → tokens
│   │   ├── parser.ts             # Tokens → AST
│   │   ├── validators.ts         # AST validation + error messages
│   │   └── __tests__/
│   ├── model/
│   │   ├── Score.ts
│   │   ├── Part.ts
│   │   ├── Voice.ts
│   │   ├── Measure.ts
│   │   ├── Note.ts
│   │   ├── Duration.ts           # Duration math utilities
│   │   └── __tests__/
│   ├── scheduler/
│   │   ├── Scheduler.ts
│   │   ├── timeline.ts
│   │   └── __tests__/
│   ├── adapters/
│   │   ├── renderer/
│   │   │   ├── VexFlowAdapter.ts
│   │   │   ├── StaveBuilder.ts
│   │   │   ├── BeamGrouper.ts
│   │   │   └── __tests__/
│   │   └── audio/
│   │       ├── ToneAdapter.ts
│   │       ├── instruments/
│   │       │   ├── piano.ts
│   │       │   ├── strings.ts
│   │       │   └── choir.ts
│   │       └── __tests__/
│   ├── node/
│   │   └── index.ts              # Node.js entry (no Web Audio)
│   └── index.ts                  # Browser entry
├── tests/
│   ├── integration/
│   │   ├── simple-melody.test.ts
│   │   ├── satb-chorale.test.ts
│   │   ├── triplets.test.ts
│   │   └── dynamics.test.ts
│   └── snapshots/                # SVG snapshot tests
├── examples/
│   ├── simple-melody/
│   ├── choir/
│   ├── piano-piece/
│   └── react-integration/
├── docs/
│   ├── syntax.md
│   ├── api.md
│   ├── advanced.md
│   └── examples.md
├── scripts/
│   ├── build.ts
│   └── release.ts
├── package.json
├── tsconfig.json
├── rollup.config.ts              # Bundler config
├── vitest.config.ts
└── README.md
```

---

## Development Phases

---

### Phase 0 — Foundation (Week 1)

**Goal:** A working repository with zero features but a solid skeleton.

**Tasks:**
1. Initialize repo with TypeScript strict mode
2. Set up Rollup for dual ESM + CJS output
3. Configure Vitest for unit tests + snapshot tests
4. Set up ESLint + Prettier + Husky pre-commit hooks
5. Write the `Note`, `Duration`, and `Pitch` value objects with full unit tests
6. Write the `Score`, `Part`, `Voice`, `Measure` model classes — no rendering yet
7. Set up CI with GitHub Actions (test on Node 18, 20, 22 + browser headless)

**Output:** `npm test` passes. No user-facing API yet.

**Best practice:** The model layer should have 100% test coverage before any parser or renderer is written. Music theory bugs (wrong beat counts, bad tuplet math) are the hardest to debug later.

---

### Phase 1 — Parser (Weeks 2–3)

**Goal:** Parse the note syntax string into a validated AST.

**Tasks:**
1. Write the tokenizer — splits string into `PitchToken`, `DurationToken`, `DynamicToken`, `GroupToken`, `BarlineToken`
2. Write the parser — converts token stream into `NoteNode[]` AST
3. Write validator — checks beat counts match time signature, detects unknown pitches, bad durations
4. Write error formatter — human-readable messages with position info
5. Write exhaustive unit tests: 
   - All 12 pitches in 7 octaves
   - All 7 durations + dotted versions
   - Chords `[C4 E4 G4]`
   - Triplets `{C4 D4 E4}`
   - Ties `C4:h~C4:h`
   - Slurs `(E4:q F4:q)`
   - All dynamics
   - Rests `R:q`
   - Multiple voices
   - Error cases with good messages

**Output:** `parse('C4:q D4:q E4:h')` returns a clean AST. Bad input returns a descriptive error.

**Best practice:** Write the parser test suite FIRST (TDD). Define what every input should produce as output before writing the parser. This is the most critical module — downstream bugs almost always originate here.

---

### Phase 2 — Core Engine (Weeks 3–4)

**Goal:** Connect the parser to the Score Model and build the Scheduler.

**Tasks:**
1. Write the AST-to-Model converter: `NoteNode[]` → `Score`
2. Implement beat counting and measure boundary detection
3. Implement tuplet duration math (triplets, quintuplets)
4. Implement multi-voice alignment (voices share measure structure)
5. Write the Scheduler: `Score` → `Timeline` (array of `{ time: number, note: NoteEvent }`)
6. Handle tempo, time signature changes mid-piece
7. Write integration tests: parse a string → build score → generate timeline → verify timestamps

**Output:** `new Song({ tempo: 120 }).add('C4:q D4:q E4:q F4:q')` produces a correct 2-second timeline.

**Best practice:** Keep the Scheduler completely stateless. Given the same Score, it always produces the same Timeline. This makes it trivially testable and cacheable.

---

### Phase 3 — Sheet Renderer (Weeks 5–6)

**Goal:** Render a Score Model to SVG via VexFlow.

**Tasks:**
1. Write the `VexFlowAdapter` — wraps VexFlow's verbose API
2. Implement single-staff rendering (treble clef, one voice)
3. Implement automatic line wrapping (measures per line)
4. Implement multi-staff rendering (grand staff, SATB)
5. Implement: clef symbols, key signatures, time signatures
6. Implement: beam grouping (eighth/sixteenth notes grouped correctly)
7. Implement: ties, slurs, dynamic markings
8. Implement: title, composer, tempo marking
9. Write SVG snapshot tests (render → compare to stored SVG)
10. Test rendering in headless browser (Playwright)

**Output:** `song.render('#container')` produces correct, legible sheet music SVG.

**Best practice:** Snapshot tests are essential here. Every rendering change should be a deliberate, reviewed diff — not a surprise. Store a library of reference SVGs covering all feature combinations and diff against them on every CI run.

---

### Phase 4 — Audio Player (Weeks 7–8)

**Goal:** Play the Timeline via Tone.js with realistic instrument sounds.

**Tasks:**
1. Write the `ToneAdapter` — wraps Tone.js Transport and Sampler
2. Implement piano instrument (use Salamander piano samples via CDN, or Tone.js PolySynth for zero-dep fallback)
3. Implement play, pause, stop, seekTo
4. Implement dynamic shaping (pp → velocity 20, ff → velocity 110)
5. Implement articulation (staccato shortens note duration, legato extends)
6. Implement the Events API: `beat`, `note`, `measure`, `end`
7. Implement multi-voice playback (each voice on a separate synth channel)
8. Write tests using Tone.js offline rendering context (no actual audio output)

**Output:** `song.play()` plays correctly timed, dynamically shaped audio. Events fire accurately.

**Best practice:** Always test audio timing in offline mode. Real-time audio tests are flaky. Tone.js's `OfflineContext` renders audio synchronously and lets you inspect the output waveform programmatically.

---

### Phase 5 — Node.js Support (Week 9)

**Goal:** Full sheet rendering support in Node with no browser APIs.

**Tasks:**
1. Create a Node-specific entry point (`maestro-js/node`)
2. Replace Web Audio API with offline audio rendering or stub it out
3. Test SVG export in Node (no DOM — use a virtual DOM or JSDOM)
4. Implement `exportSVG()` returning a string
5. Implement optional `exportPNG()` via `sharp` (peer dep, not required)
6. Test in Node 18, 20, 22
7. Document the Node entry point separately

**Output:** Works in a Next.js API route, a CLI tool, or a build script.

---

### Phase 6 — Export & Advanced Features (Week 10)

**Goal:** MIDI export, JSON score format, and polish.

**Tasks:**
1. Implement `exportMIDI()` — produces a standard MIDI file buffer (use `midi-writer-js` internally)
2. Implement `exportJSON()` / `Song.fromJSON()` — portable save/load format
3. Implement `exportSVG()` in browser (same as Node output)
4. Add `repeat()` and `da capo` markers
5. Add tempo change mid-piece: `song.tempoAt(measure: 4, bpm: 88)`
6. Add fermata: `C4:w(fermata)`
7. Add `song.transpose(semitones: number)` utility

---

### Phase 7 — Documentation & Examples (Week 11)

**Goal:** Documentation so clear that no support questions are needed.

**Pages to write:**
- `README.md` — 5-minute quick start, install, 3 examples (simple, intermediate, SATB)
- `docs/syntax.md` — complete note syntax reference with every feature
- `docs/api.md` — full JSDoc-based API reference
- `docs/advanced.md` — multi-voice, dynamics, events, Node.js, exports
- `examples/` — 4 working examples with their own README

**Best practice:** The README must render the output. Include actual SVG screenshots of rendered sheet music in the README. A library that shows music should demonstrate music visually before the developer installs it.

---

### Phase 8 — Publish (Week 12)

**Goal:** A published, production-ready npm package.

**Pre-publish checklist:**
- [ ] All tests pass on CI (Node 18/20/22, Chrome headless, Firefox headless)
- [ ] Bundle size measured and documented (target: < 150kb gzipped including Tone.js)
- [ ] TypeScript types exported and verified with `tsd`
- [ ] `package.json` exports field correct for ESM + CJS + Node
- [ ] Provenance attestation enabled (`npm publish --provenance`)
- [ ] `CHANGELOG.md` written for v1.0.0
- [ ] GitHub release created with SVG screenshot examples
- [ ] npm README uploaded with rendered SVG screenshots

**Versioning strategy:** Semantic versioning strictly. `1.x.x` for stable API. Any syntax breaking change = major version bump.

---

## Best Practices Across the Entire Build

### TypeScript

Use strict mode throughout. Define strong types for every internal model:

```ts
type Pitch = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
type Accidental = '#' | 'b' | 'bb' | '##' | null
type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
type Duration = 'w' | 'h' | 'q' | 'e' | 's' | 't'

interface Note {
  pitch: Pitch
  accidental: Accidental
  octave: Octave
  duration: Duration
  dotted: boolean
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
}
```

Never use `any`. Use `unknown` + type guards for JSON input. Export all public-facing types.

---

### Error Messages

The most important UX in a library is its error messages. Every error must:
1. Say what went wrong in plain English
2. Show exactly where in the input string the problem is
3. Suggest the correct fix

```
MaestroError: Unrecognized note token "H4" at position 12.
  Input: "C4:q D4:q H4:q F4:q"
                     ^^^
  "H" is not a valid note name. Valid notes are: C D E F G A B
  Did you mean: A4?
```

---

### Testing Strategy

| Layer | Test Type | Tool | Coverage Target |
|---|---|---|---|
| Parser | Unit | Vitest | 100% |
| Score Model | Unit | Vitest | 100% |
| Scheduler | Unit (offline) | Vitest | 95% |
| Renderer | Snapshot | Vitest + Playwright | 90% |
| Audio | Integration (offline) | Vitest | 85% |
| Full API | Integration | Playwright | Key user flows |

Run tests in watch mode during development. CI runs the full suite on every pull request.

---

### Bundle Strategy

Use Rollup with three output targets:

```
dist/
├── maestro.esm.js       # ES Modules (tree-shakeable)
├── maestro.cjs.js       # CommonJS (require())
├── maestro.umd.js       # UMD (script tag, CDN)
├── maestro.node.esm.js  # Node.js (no Web Audio)
└── maestro.d.ts         # TypeScript types
```

The `package.json` exports field routes automatically:

```json
{
  "exports": {
    ".": {
      "import": "./dist/maestro.esm.js",
      "require": "./dist/maestro.cjs.js",
      "browser": "./dist/maestro.esm.js"
    },
    "./node": {
      "import": "./dist/maestro.node.esm.js"
    }
  }
}
```

---

### Versioning & Releases

- Main branch is always releasable
- Feature branches merged via pull request
- Changelog is written before version bump, not after
- Use `changesets` for automated changelog + version management
- Every release is tagged in Git

---

## The Finished Product — Full Feature Checklist

### Core Syntax
- [x] All 12 pitches across 9 octaves
- [x] All standard durations (whole through thirty-second)
- [x] Dotted durations
- [x] Rests
- [x] Chords
- [x] Triplets and other tuplets
- [x] Ties
- [x] Slurs
- [x] Barlines
- [x] All standard dynamics (ppp through fff)
- [x] Crescendo / decrescendo markers

### Rendering
- [x] Treble, bass, alto, tenor clefs
- [x] All major and minor key signatures
- [x] All standard time signatures
- [x] Automatic beam grouping
- [x] Multi-staff (grand staff, SATB)
- [x] Title, composer, tempo marking
- [x] Bar numbers
- [x] Dynamic markings rendered under staff
- [x] Automatic line wrapping
- [x] Light and dark theme

### Playback
- [x] Piano, strings, choir, organ instruments
- [x] Dynamic velocity shaping
- [x] Staccato and legato articulation
- [x] Multi-voice polyphonic playback
- [x] Play, pause, stop, seek
- [x] Events API (beat, note, measure, end)

### Exports
- [x] SVG (browser + Node)
- [x] PNG (Node, optional via sharp)
- [x] MIDI
- [x] JSON (save/load format)

### Developer Experience
- [x] Full TypeScript types
- [x] Human-readable error messages with position info
- [x] Works with React, Vue, Svelte, plain HTML
- [x] Works in Next.js / Nuxt server-side
- [x] CDN script tag support (no build tools needed)
- [x] Zero required configuration

---

## Integration Examples for App Developers

### Plain HTML (no build tools)

```html
<script src="https://cdn.jsdelivr.net/npm/maestro-js/dist/maestro.umd.js"></script>
<div id="sheet"></div>
<script>
  const song = new Maestro.Song({ tempo: 100 })
  song.add('C4 E4 G4 C5 | G4:h E4:h | C4:w')
  song.render('#sheet')
  song.play()
</script>
```

### React

```jsx
import { useEffect, useRef } from 'react'
import { Song } from 'maestro-js'

export function SheetMusic({ notation, tempo = 120 }) {
  const containerRef = useRef(null)
  const songRef = useRef(null)

  useEffect(() => {
    const song = new Song({ tempo })
    song.add(notation)
    song.render(containerRef.current)
    songRef.current = song
    return () => song.stop()
  }, [notation, tempo])

  return (
    <div>
      <div ref={containerRef} />
      <button onClick={() => songRef.current?.play()}>Play</button>
      <button onClick={() => songRef.current?.pause()}>Pause</button>
    </div>
  )
}
```

### Next.js (server-side SVG rendering)

```ts
// app/api/sheet/route.ts
import { Song } from 'maestro-js/node'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const notation = searchParams.get('n') ?? 'C4 E4 G4'

  const song = new Song({ tempo: 120 })
  song.add(notation)
  const svg = song.exportSVG()

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  })
}
```

---

## Timeline Summary

| Week | Phase | Milestone |
|---|---|---|
| 1 | Foundation | Repo, tooling, model layer with full tests |
| 2–3 | Parser | Note syntax fully parsed and validated |
| 3–4 | Core Engine | Score model + playback scheduler working |
| 5–6 | Renderer | Sheet music rendering via VexFlow |
| 7–8 | Audio Player | Playback with dynamics + events API |
| 9 | Node.js | Server-side SVG export |
| 10 | Exports + Polish | MIDI, JSON, transpose, repeats |
| 11 | Docs + Examples | README, API docs, 4 working examples |
| 12 | Publish | v1.0.0 on npm |

---

## What Success Looks Like

A choirmaster opens a web app built with Maestro.js. They type a few bars of a Handel chorale using the note syntax. Instantly, four staves appear — soprano, alto, tenor, bass — correctly notated with key signature, time signature, dynamics, and beamed eighth notes. They click play. The choir voices come to life in the browser. They export a PDF for rehearsal. They share a link that renders the score server-side.

A songwriter's daughter — age eight — opens the same app. She types the notes to "Mary Had a Little Lamb" because she learned the note names in school. She presses play. It works.

Both of them used the same library. Neither of them read more than half a page of documentation.

That is Maestro.js v1.0.0.

---

*Document version 1.0 — created April 2026*
