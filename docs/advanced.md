# Advanced Usage

Multi-voice writing, dynamics, playback events, server-side rendering, and export formats.

---

## Multi-Voice Writing

Use named voices for arrangements with multiple parts:

```js
import { Song } from 'maestro-js'

const song = new Song({ tempo: 80, key: 'F', title: 'Duet' })

song.voice('melody', { clef: 'treble' }).add('F4:q(mf) A4:q C5:h | Bb4:q A4:q G4:h')

song.voice('accompaniment', { clef: 'bass' }).add('[F2 C3]:h [F2 A2]:h | [Bb2 D3]:h [C3 E3]:h')

song.render('#score', { grandStaff: true })
```

### Available Clefs

| Clef         | Usage                           |
| ------------ | ------------------------------- |
| `'treble'`   | Soprano, Alto, Melody (default) |
| `'bass'`     | Bass, Left hand                 |
| `'alto'`     | Viola                           |
| `'tenor'`    | Cello, Trombone                 |
| `'treble-8'` | Tenor voice (octave lower)      |

### SATB Example

```js
const chorale = new Song({ tempo: 72, key: 'Bb' })

chorale.voice('soprano', { clef: 'treble' }).add('Bb4:h C5:q D5:q | Eb5:h D5:h')

chorale.voice('alto', { clef: 'treble' }).add('F4:h G4:q F4:q | G4:h F4:h')

chorale.voice('tenor', { clef: 'treble-8' }).add('D4:h Eb4:q F4:q | Bb4:h F4:h')

chorale.voice('bass', { clef: 'bass' }).add('Bb2:h Eb3:q F3:q | Eb3:h Bb3:h')

chorale.render('#score', { grandStaff: true, showBarNumbers: true })
```

---

## Dynamics & Expression

### Inline Dynamics

Dynamics attach to individual notes:

```js
song.add('C4:q(pp) D4:q(p) E4:q(mp) F4:q(mf) G4:q(f) A4:q(ff) B4:q(fff)')
```

### Hairpins

Start crescendo or decrescendo from a dynamic level:

```js
song.add('C4:q(p<) D4:q E4:q F4:q(mf)') // crescendo p → mf
song.add('G4:q(f>) F4:q E4:q D4:q(p)') // decrescendo f → p
```

### Fermata

Hold a note beyond its written duration (2x in playback):

```js
song.add('C4:q D4:q E4:q G4:w(fermata)')
```

---

## Ties, Slurs & Articulation

### Ties

Connect notes of the same pitch across beats or barlines:

```js
song.add('C4:h~C4:h') // Sounds like a whole note
song.add('G4:q~G4:q | G4:h') // Tie across barline
```

### Slurs

Indicate legato phrasing across different pitches:

```js
song.add('(C4:q D4:q E4:q F4:q)')
```

---

## Triplets

Three notes in the time of one beat:

```js
song.add('{C4 D4 E4}:q') // Three notes fit in one quarter
song.add('{G4 A4 B4}:h') // Three notes fit in one half
```

---

## Repeat Structures

### Repeat Bars

```js
song.add('|: C4:q D4:q E4:q F4:q :|')
```

The section between `|:` and `:|` plays twice.

### Da Capo (D.C.)

Replay the entire piece from the beginning:

```js
song.add('C4:q D4:q | E4:q F4:q | D.C.')
```

---

## Tempo Changes

Set tempo changes at specific measures:

```js
const song = new Song({ tempo: 120 })
song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | C5:w')

song.tempoAt(2, 80) // Slow down at measure 2
song.tempoAt(3, 60) // Even slower at measure 3
```

---

## Transposition

Shift all notes up or down by semitones:

```js
const song = new Song()
song.add('C4:q E4:q G4:q C5:q')

song.transpose(2) // Now: D4 F#4 A4 D5
song.transpose(-5) // Shift down a perfect fourth
```

Transposition applies to all voices including named ones.

---

## Playback Events

Hook into playback for visual synchronization:

```js
song.on('beat', ({ beat, measure, time }) => {
  highlightBeat(measure, beat)
})

song.on('note', ({ pitch, voice, duration, time }) => {
  flashPianoKey(pitch)
})

song.on('measure', ({ measure }) => {
  scrollToMeasure(measure)
})

song.on('end', () => {
  showReplayButton()
})
```

### Selective Playback

```js
// Play only soprano and alto
await song.play({ voices: ['soprano', 'alto'] })

// Solo the bass voice
await song.play({ voices: ['bass'], solo: true })
```

---

## Export Formats

### SVG

```js
const svg = song.exportSVG({ width: 1200, showDynamics: true })
document.getElementById('output').innerHTML = svg
```

### MIDI

```js
const midi = await song.exportMIDI()

// In browser — trigger download
const blob = new Blob([midi], { type: 'audio/midi' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'song.mid'
a.click()

// In Node.js
import fs from 'fs'
fs.writeFileSync('song.mid', midi)
```

### PNG (requires `sharp`)

```bash
npm install sharp
```

```js
const png = await song.exportPNG({ width: 1200 })
fs.writeFileSync('sheet.png', png)
```

### JSON (Save / Load)

```js
// Save
const json = song.exportJSON()
const str = JSON.stringify(json)

// Load
const restored = Song.fromJSON(JSON.parse(str))
```

The JSON format preserves the original notation strings, allowing perfect round-trips. All voices, tempo changes, and options are restored.

---

## Node.js / Server-side

Import from the `/node` subpath for server-side usage:

```js
import { Song } from 'maestro-js/node'
```

This entry point uses `jsdom` for SVG rendering without a browser. All export methods work:

```js
import { Song } from 'maestro-js/node'
import fs from 'fs'

const song = new Song({ tempo: 100, key: 'G' })
song.add('G4:q A4:q B4:q D5:q | G5:w')

// SVG
fs.writeFileSync('output.svg', song.exportSVG())

// MIDI
const midi = await song.exportMIDI()
fs.writeFileSync('output.mid', midi)

// PNG (requires sharp)
const png = await song.exportPNG()
fs.writeFileSync('output.png', png)
```

### Next.js API Route

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
    headers: { 'Content-Type': 'image/svg+xml' },
  })
}
```

---

## Error Handling

Maestro.js throws descriptive errors for common issues:

| Situation               | Error                                         |
| ----------------------- | --------------------------------------------- |
| Invalid render target   | `Render target "#foo" not found.`             |
| Missing `sharp` for PNG | `exportPNG() requires the "sharp" package...` |
| Invalid notation syntax | Parse error with position info                |

All methods that return `this` allow chaining:

```js
new Song({ tempo: 100 }).add('C4:q D4:q E4:q F4:q').transpose(2).render('#sheet')
```
