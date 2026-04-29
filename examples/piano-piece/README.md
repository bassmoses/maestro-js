# Piano Piece Example

A piano piece demonstrating dynamics, chords, dotted notes, and tempo changes.

## Usage

```js
import { Song } from 'maestro-js'

const song = new Song({
  tempo: 112,
  timeSignature: '4/4',
  key: 'D',
  instrument: 'piano',
})

// Right hand — melody with dynamics
song
  .voice('right', { clef: 'treble' })
  .add('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h')
  .add('E4:q(mp) F#4:q G4:q F#4:q | D4:w(p)')

// Left hand — chords
song
  .voice('left', { clef: 'bass' })
  .add('[D2 A2]:h [D2 F#2]:h | [A2 C#3]:h [D2 A2]:h')
  .add('[G2 B2]:h [A2 C#3]:h | [D2 A2]:w')

// Tempo change for the ending
song.tempoAt(3, 92)

song.render('#sheet', { grandStaff: true, showDynamics: true })
```

## Features Demonstrated

- Two voices (treble + bass clef) for piano
- Chord notation
- Dynamics (mp, mf, p)
- Grand staff rendering
- Tempo change mid-piece
