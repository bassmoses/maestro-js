# API Reference

Complete reference for the `maestro-js` public API.

---

## `Song`

The primary class for creating, rendering, and playing music.

```ts
import { Song } from 'maestro-js'
```

### `new Song(options?)`

Create a new song.

```ts
interface SongOptions {
  tempo?: number // BPM, default: 120
  timeSignature?: string // e.g. '4/4', '3/4', '6/8', default: '4/4'
  key?: string // Key signature, default: 'C'
  instrument?: string // Playback instrument, default: 'piano'
  title?: string // Score title
  composer?: string // Composer name
}
```

**Example:**

```js
const song = new Song({ tempo: 100, key: 'G', timeSignature: '3/4' })
```

---

### `song.add(notation)`

Add notation to the default voice. Returns `this` for chaining.

```js
song.add('C4:q D4:q E4:q F4:q')
song.add('G4:h E4:h | C4:w')
```

Multiple `add()` calls append to the same voice — the notation is concatenated.

---

### `song.voice(name, options?)`

Create or retrieve a named voice. Returns a `Voice` instance.

```ts
interface VoiceOptions {
  clef?: 'treble' | 'bass' | 'alto' | 'tenor' | 'treble-8'
}
```

```js
const soprano = song.voice('soprano', { clef: 'treble' })
soprano.add('C5:q D5:q E5:h')
```

Calling `voice()` with the same name returns the existing voice.

---

### `song.render(target, options?)`

Render sheet music to a DOM element. Returns `this`.

```ts
interface RenderOptions {
  width?: number // Canvas width in pixels
  theme?: 'light' | 'dark' // Color theme
  showDynamics?: boolean // Show dynamic markings
  grandStaff?: boolean // Connect staves with brace
  showBarNumbers?: boolean // Show measure numbers
}
```

**Parameters:**

- `target` — CSS selector string or `HTMLElement`

```js
song.render('#sheet', { width: 800, showDynamics: true })
song.render(document.getElementById('container'))
```

---

### `song.play(options?)`

Start audio playback. Returns `Promise<this>`.

```ts
interface PlayOptions {
  voices?: string[] // Voice names to play (default: all)
  solo?: boolean // Solo the specified voices
}
```

```js
await song.play()
await song.play({ voices: ['soprano', 'alto'] })
```

---

### `song.pause()`

Pause playback. Returns `this`.

---

### `song.stop()`

Stop playback and reset to the beginning. Returns `this`.

---

### `song.seekTo(position)`

Jump to a specific position. Returns `this`.

```ts
interface SeekPosition {
  measure: number // 1-based measure number
  beat: number // 1-based beat number
}
```

```js
song.seekTo({ measure: 3, beat: 1 })
```

---

### `song.on(event, handler)`

Register a playback event listener. Returns `this`.

| Event       | Data                               | Description              |
| ----------- | ---------------------------------- | ------------------------ |
| `'beat'`    | `{ beat, measure, time }`          | Fired on each beat       |
| `'note'`    | `{ pitch, voice, duration, time }` | Fired when a note plays  |
| `'measure'` | `{ measure, time }`                | Fired at measure start   |
| `'end'`     | `{}`                               | Fired when playback ends |

```js
song.on('beat', ({ measure, beat }) => {
  console.log(`Measure ${measure}, Beat ${beat}`)
})
```

---

### `song.off(event, handler)`

Remove a previously registered handler. Returns `this`.

---

### `song.exportSVG(options?)`

Render the score to an SVG string. Accepts the same `RenderOptions` as `render()`.

```js
const svg = song.exportSVG({ width: 1200 })
```

---

### `song.exportMIDI()`

Export the score as a standard MIDI file. Returns `Promise<Uint8Array>`.

```js
const midi = await song.exportMIDI()
fs.writeFileSync('output.mid', midi)
```

---

### `song.exportPNG(options?)`

Export the score as a PNG image. Requires the `sharp` package. Returns `Promise<Uint8Array>`.

```js
const png = await song.exportPNG({ width: 1200 })
fs.writeFileSync('sheet.png', png)
```

---

### `song.exportJSON()`

Export the song as a portable JSON object for saving/loading.

```js
const data = song.exportJSON()
localStorage.setItem('song', JSON.stringify(data))
```

---

### `Song.fromJSON(json)`

Static method. Reconstruct a Song from a previously exported JSON object.

```js
const data = JSON.parse(localStorage.getItem('song'))
const song = Song.fromJSON(data)
```

---

### `song.transpose(semitones)`

Transpose all notes by a number of semitones. Positive = up, negative = down. Returns `this`.

```js
song.transpose(2) // Up a whole step
song.transpose(-3) // Down a minor third
```

---

### `song.tempoAt(measure, bpm)`

Set a tempo change at a specific measure. Returns `this`.

```js
song.tempoAt(5, 80) // Slow down at measure 5
song.tempoAt(9, 120) // Return to original tempo
```

---

### `song.getScore()`

Get the internal `Score` model. For advanced use — render adapters and scheduler consume this.

---

### `song.getTimeline()`

Build and return the playback `Timeline` (array of timed events).

---

## `Voice`

Represents a named voice/part within a song.

```js
const voice = song.voice('tenor', { clef: 'treble-8' })
```

### `voice.add(notation)`

Add notation to this voice. Returns `this` (the Voice, not the Song — for chaining).

```js
song.voice('bass', { clef: 'bass' }).add('C3:h E3:h | G3:w').add('F3:q G3:q A3:h | C3:w')
```

### `voice.getClef()`

Returns the voice's clef setting.

### `voice.getNotations()`

Returns the array of notation strings added to this voice.

---

## Node.js Entry Point

For server-side usage (SVG/PNG/MIDI generation without browser APIs):

```js
import { Song } from 'maestro-js/node'
```

Same API as the browser entry, except `play()`, `pause()`, `stop()`, and `render()` to DOM are unavailable. Use `exportSVG()`, `exportMIDI()`, `exportPNG()`, and `exportJSON()` instead.

---

## Types

All public TypeScript types are exported:

```ts
import type { SongOptions, RenderOptions, PlayOptions, SeekPosition } from 'maestro-js'
```
