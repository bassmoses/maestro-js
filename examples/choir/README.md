# SATB Choir Example

A four-part choral arrangement using named voices with separate clefs.

## Usage

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
```

## Features Demonstrated

- Named voices with different clefs
- Grand staff rendering
- Dynamics per voice
- Bar numbers
- Title and composer metadata
