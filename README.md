# Maestro.js

**Write music. See music. Hear music.** A human-friendly JavaScript library that turns simple text notation into rendered sheet music and audio playback.

```js
import { Song } from 'maestro-js'

const song = new Song()
song.add('C4 D4 E4 F4 G4')
song.render('#sheet')
song.play()
```

Three lines after import — renders a staff and plays the notes.

---

## Install

```bash
npm install maestro-js
```

No peer dependencies to configure. VexFlow and Tone.js are bundled internally.

### Optional

```bash
npm install sharp   # only needed for exportPNG()
```

---

## Quick Start

### Simple Melody

```js
import { Song } from 'maestro-js'

const song = new Song({ tempo: 100, key: 'C' })
song.add('C4:q E4:q G4:q C5:q | G4:h E4:h | C4:w')
song.render('#sheet')
song.play()
```

### Intermediate — Dynamics, Chords & Dotted Notes

```js
import { Song } from 'maestro-js'

const song = new Song({
  tempo: 112,
  timeSignature: '4/4',
  key: 'D',
  instrument: 'piano',
})

// Verse melody with dynamics
song.add('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h | E4:q(mp) F#4:q G4:q F#4:q | D4:w(p)')

// Chorus with chords
song.add('[D4 F#4 A4]:h(f) [A4 C#5 E5]:h | [G4 B4 D5]:h(ff) [A4 C#5 E5]:h(mf)')

song.render('#sheet-container', { width: 800, showDynamics: true })
song.play()
```

### Full SATB Choir

```js
import { Song } from 'maestro-js'

const chorale = new Song({
  tempo: 76,
  timeSignature: '4/4',
  key: 'Bb',
  title: 'Sanctus',
  composer: 'Anonymous',
})

chorale
  .voice('soprano', { clef: 'treble' })
  .add('Bb4:h(mp) C5:q D5:q | Eb5:h D5:h | C5:q(mf) Bb4:q C5:h | Bb4:w(p)')

chorale
  .voice('alto', { clef: 'treble' })
  .add('F4:h G4:q F4:q | G4:h F4:h | Eb4:q(mf) F4:q Eb4:h | D4:w(p)')

chorale
  .voice('tenor', { clef: 'treble-8' })
  .add('D4:h Eb4:q F4:q | Bb4:h F4:h | G4:q(mf) F4:q G4:h | F4:w(p)')

chorale
  .voice('bass', { clef: 'bass' })
  .add('Bb2:h Eb3:q F3:q | Eb3:h Bb3:h | F3:q(mf) F2:q C3:h | Bb2:w(p)')

chorale.render('#score', { grandStaff: true, showBarNumbers: true })
chorale.play()
```

---

## Note Syntax at a Glance

| Feature        | Syntax                        | Example             |
| -------------- | ----------------------------- | ------------------- |
| Pitch + Octave | `A-G` + `0-8`                 | `C4`, `F#5`, `Bb3`  |
| Duration       | `:w` `:h` `:q` `:e` `:s` `:t` | `C4:q` (quarter)    |
| Dotted         | `.` after duration            | `G4:h.`             |
| Rest           | `R`                           | `R:q`               |
| Chord          | `[...]`                       | `[C4 E4 G4]:h`      |
| Triplet        | `{...}`                       | `{C4 D4 E4}:q`      |
| Dynamic        | `(pp)` to `(fff)`             | `C4:q(mf)`          |
| Tie            | `~`                           | `C4:h~C4:h`         |
| Slur           | `(...)`                       | `(E4:q F4:q G4:h)`  |
| Fermata        | `(fermata)`                   | `C4:w(fermata)`     |
| Barline        | `\|`                          | `C4:q D4:q \| E4:h` |
| Repeat         | `\|:` ... `:\|`               | `\|: C4:q D4:q :\|` |
| Da Capo        | `D.C.`                        | `C4:w \| D.C.`      |

Full syntax reference: [docs/syntax.md](docs/syntax.md)

---

## API Overview

### `new Song(options?)`

```ts
const song = new Song({
  tempo: 120, // BPM (default: 120)
  timeSignature: '4/4',
  key: 'C', // Key signature
  instrument: 'piano',
  title: 'My Song',
  composer: 'Me',
})
```

### Writing Music

```js
song.add('C4:q D4:q E4:q F4:q') // Add to default voice
song.voice('tenor', { clef: 'treble-8' }).add('...') // Named voice
```

### Rendering & Playback

```js
song.render('#container', { width: 800 }) // Render sheet music
song.play() // Start playback
song.pause() // Pause
song.stop() // Stop & reset
song.seekTo({ measure: 3, beat: 1 }) // Jump to position
```

### Export

```js
const svg = song.exportSVG() // SVG string
const midi = await song.exportMIDI() // MIDI Uint8Array
const png = await song.exportPNG() // PNG buffer (requires sharp)
const json = song.exportJSON() // Portable JSON
const restored = Song.fromJSON(json) // Reconstruct from JSON
```

### Advanced

```js
song.transpose(2)                           // Shift all notes up 2 semitones
song.tempoAt(5, 80)                         // Tempo change at measure 5
song.on('beat', ({ measure }) => { ... })   // Playback events
```

Full API reference: [docs/api.md](docs/api.md)

---

## Node.js (Server-side)

```js
import { Song } from 'maestro-js/node'
import fs from 'fs'

const song = new Song({ tempo: 90 })
song.add('G4:q A4:q B4:q C5:q | D5:w')

const svg = song.exportSVG()
fs.writeFileSync('sheet.svg', svg)

const png = await song.exportPNG()
fs.writeFileSync('sheet.png', png)
```

---

## Plain HTML (UMD)

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

---

## Documentation

- [Note Syntax Reference](docs/syntax.md)
- [API Reference](docs/api.md)
- [Advanced Usage](docs/advanced.md) — multi-voice, events, exports, Node.js

---

## Examples

- [`examples/simple-melody/`](examples/simple-melody/) — Minimal usage
- [`examples/choir/`](examples/choir/) — SATB choral arrangement
- [`examples/piano-piece/`](examples/piano-piece/) — Piano with dynamics & chords
- [`examples/react-integration/`](examples/react-integration/) — React component

---

## License

MIT
