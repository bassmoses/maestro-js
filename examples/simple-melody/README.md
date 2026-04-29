# Simple Melody Example

The simplest possible Maestro.js usage — a C major scale rendered and played.

## Usage

```bash
# Open index.html in a browser
```

Or import as a module:

```js
import { Song } from 'maestro-js'

const song = new Song({ tempo: 100 })
song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | C5:w')
song.render('#sheet')
song.play()
```

## Files

- `index.html` — Standalone HTML page using the UMD bundle
- `main.js` — ES module version
