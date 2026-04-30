<div align="center">

# Maestro.js

**Write music. See music. Hear music.**

A human-friendly JavaScript library that turns simple text notation into rendered sheet music and audio playback.

[![npm version](https://img.shields.io/npm/v/@bassmoses/maestro-js?color=0969da)](https://www.npmjs.com/package/@bassmoses/maestro-js)
[![license](https://img.shields.io/npm/l/@bassmoses/maestro-js?color=0969da)](LICENSE)
[![node](https://img.shields.io/node/v/@bassmoses/maestro-js?color=0969da)](package.json)

</div>

```js
import { Song } from '@bassmoses/maestro-js'

const song = new Song()
song.add('C4 D4 E4 F4 G4')
song.render('#sheet')
song.play()
```

Three lines after import — renders a staff and plays the notes.

---

## Install

```bash
npm install @bassmoses/maestro-js
```

No peer dependencies to configure. VexFlow and Tone.js are bundled internally.

**Optional** — only needed for `exportPNG()`:

```bash
npm install sharp
```

---

## Quick Start

### Simple Melody

```js
import { Song } from '@bassmoses/maestro-js'

const song = new Song({ tempo: 100, key: 'C' })
song.add('C4:q E4:q G4:q C5:q | G4:h E4:h | C4:w')
song.render('#sheet')
song.play()
```

### Dynamics, Chords & Lyrics

```js
import { Song } from '@bassmoses/maestro-js'

const song = new Song({
  tempo: 112,
  timeSignature: '4/4',
  key: 'D',
  instrument: 'piano',
})

// Melody with dynamics
song.add('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h | E4:q(mp) F#4:q G4:q F#4:q | D4:w(p)')

// Chords
song.add('[D4 F#4 A4]:h(f) [A4 C#5 E5]:h | [G4 B4 D5]:h(ff) [A4 C#5 E5]:h(mf)')

// Lyrics attached to notes
song.add('C4:q"Hel" D4:q"lo" E4:h"world"')

song.render('#sheet-container', { width: 800, showDynamics: true })
song.play()
```

### Full SATB Choir with Part Names

```js
import { Song } from '@bassmoses/maestro-js'

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

chorale.render('#score', {
  grandStaff: true,
  showBarNumbers: true,
  showPartNames: true, // labels each stave (default: true)
  partNameStyle: 'full', // 'full' or 'abbreviated' (default)
})
chorale.play()
```

### Looping a Section

```js
song.loop(2, 4) // repeat measures 2–4 during playback
song.play()
song.clearLoop() // remove the loop
```

---

## Note Syntax at a Glance

| Feature        | Syntax                        | Example             |
| :------------- | :---------------------------- | :------------------ |
| Pitch + Octave | `A`–`G` + `0`–`8`             | `C4`, `F#5`, `Bb3`  |
| Duration       | `:w` `:h` `:q` `:e` `:s` `:t` | `C4:q` (quarter)    |
| Dotted         | `.` after duration            | `G4:h.`             |
| Rest           | `R`                           | `R:q`               |
| Chord          | `[...]`                       | `[C4 E4 G4]:h`      |
| Triplet        | `{...}`                       | `{C4 D4 E4}:q`      |
| Dynamic        | `(pp)` to `(fff)`             | `C4:q(mf)`          |
| Tie            | `~`                           | `C4:h~C4:h`         |
| Slur           | `(...)`                       | `(E4:q F4:q G4:h)`  |
| Fermata        | `(fermata)`                   | `C4:w(fermata)`     |
| Lyric          | `"text"` after note           | `C4:q"hello"`       |
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
  key: 'C',
  instrument: 'piano',
  title: 'My Song',
  composer: 'Me',
})
```

### Writing Music

```js
song.add('C4:q D4:q E4:q F4:q') // default voice
song.voice('tenor', { clef: 'treble-8' }).add('...') // named voice
```

### Rendering

```js
song.render('#container', {
  width: 800,
  theme: 'dark', // 'light' (default) or 'dark'
  showDynamics: true,
  showBarNumbers: true,
  showPartNames: true, // show voice labels on staves
  partNameStyle: 'abbreviated', // 'abbreviated' or 'full'
  grandStaff: false,
})
```

### Playback

```js
song.play() // start
song.pause() // pause
song.stop() // stop & reset
song.seekTo({ measure: 3, beat: 1 }) // jump to position
song.loop(2, 4) // loop measures 2–4
song.clearLoop() // remove loop
```

### Export & Import

```js
const svg = song.exportSVG() // SVG string
const midi = await song.exportMIDI() // MIDI Uint8Array
const png = await song.exportPNG() // PNG buffer (requires sharp)
const json = song.exportJSON() // portable JSON snapshot

const restored = Song.fromJSON(json) // reconstruct from JSON
```

### Advanced

```js
song.transpose(2)                           // shift all notes up 2 semitones
song.tempoAt(5, 80)                         // tempo change at measure 5
song.on('beat', ({ measure }) => { ... })   // playback events
```

Full API reference: [docs/api.md](docs/api.md)

---

## Node.js (Server-side)

```js
import { Song } from '@bassmoses/maestro-js/node'
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
<script src="https://cdn.jsdelivr.net/npm/@bassmoses/maestro-js/dist/maestro.umd.js"></script>
<div id="sheet"></div>
<script>
  const song = new Maestro.Song({ tempo: 100 })
  song.add('C4 E4 G4 C5 | G4:h E4:h | C4:w')
  song.render('#sheet')
  song.play()
</script>
```

---

## Dark Mode

Pass `theme: 'dark'` to `render()` — staves, notes, and text automatically use light-on-dark colors:

```js
song.render('#container', { theme: 'dark' })
```

---

## Documentation

- [Note Syntax Reference](docs/syntax.md)
- [API Reference](docs/api.md)
- [Advanced Usage](docs/advanced.md) — multi-voice, events, exports, Node.js

## Examples

- [`examples/simple-melody/`](examples/simple-melody/) — Minimal usage
- [`examples/choir/`](examples/choir/) — SATB choral arrangement
- [`examples/piano-piece/`](examples/piano-piece/) — Piano with dynamics & chords
- [`examples/react-integration/`](examples/react-integration/) — React component

---

## License

MIT
