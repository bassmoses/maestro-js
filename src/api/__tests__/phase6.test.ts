import { describe, it, expect } from 'vitest'
import { Song } from '../../api/Song.js'

describe('Song.tempoAt()', () => {
  it('sets a tempo change at a given measure', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
    song.tempoAt(2, 60)

    const timeline = song.getTimeline()
    // Measure 1 at 120 BPM: quarter = 0.5s
    expect(timeline[0].note.duration).toBeCloseTo(0.5)
    // Measure 2 at 60 BPM: quarter = 1.0s
    expect(timeline[4].note.duration).toBeCloseTo(1.0)
  })

  it('preserves tempo changes through exportJSON/fromJSON', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
    song.tempoAt(2, 80)

    const json = song.exportJSON()
    const restored = Song.fromJSON(json)
    const timeline = restored.getTimeline()

    // Measure 2 at 80 BPM: quarter = 60/80 = 0.75s
    expect(timeline[4].note.duration).toBeCloseTo(0.75)
  })

  it('is chainable', () => {
    const song = new Song()
    const result = song.tempoAt(2, 90)
    expect(result).toBe(song)
  })
})

describe('Song.transpose()', () => {
  it('transposes up by semitones', () => {
    const song = new Song()
    song.add('C4:q E4:q G4:q')
    song.transpose(3) // up a minor third

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('D#4')
    expect(timeline[1].note.pitch).toBe('G4')
    expect(timeline[2].note.pitch).toBe('A#4')
  })

  it('transposes down by semitones', () => {
    const song = new Song()
    song.add('E4:q G4:q B4:q')
    song.transpose(-2) // down a whole step

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('D4')
    expect(timeline[1].note.pitch).toBe('F4')
    expect(timeline[2].note.pitch).toBe('A4')
  })

  it('transposes notes with accidentals', () => {
    const song = new Song()
    song.add('F#4:q Bb3:q')
    song.transpose(1)

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('G4')
    expect(timeline[1].note.pitch).toBe('B3')
  })

  it('transposes across octave boundaries', () => {
    const song = new Song()
    song.add('B4:q')
    song.transpose(1) // B4 → C5

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('C5')
  })

  it('transposes chords', () => {
    const song = new Song()
    song.add('[C4 E4 G4]:h')
    song.transpose(2)

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('D4')
    expect(timeline[1].note.pitch).toBe('F#4')
    expect(timeline[2].note.pitch).toBe('A4')
  })

  it('does not affect rests', () => {
    const song = new Song()
    song.add('C4:q R:q D4:q')
    song.transpose(5)

    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('F4')
    expect(timeline[1].note.pitch).toBeNull()
    expect(timeline[2].note.pitch).toBe('G4')
  })

  it('is chainable', () => {
    const song = new Song()
    song.add('C4:q')
    const result = song.transpose(2)
    expect(result).toBe(song)
  })

  it('transposes multi-voice songs', () => {
    const song = new Song()
    const soprano = song.voice('soprano')
    soprano.add('C5:q D5:q')
    const alto = song.voice('alto')
    alto.add('E4:q F4:q')

    song.transpose(2)

    const timeline = song.getTimeline()
    const sopranoNotes = timeline.filter((e) => e.note.voice === 'soprano')
    const altoNotes = timeline.filter((e) => e.note.voice === 'alto')
    expect(sopranoNotes[0].note.pitch).toBe('D5')
    expect(altoNotes[0].note.pitch).toBe('F#4')
  })
})

describe('Song.exportJSON() / Song.fromJSON()', () => {
  it('round-trips a simple song', () => {
    const song = new Song({ tempo: 88, key: 'F', title: 'Test' })
    song.add('C4:q D4:h E4:e F4:e')

    const json = song.exportJSON()
    const restored = Song.fromJSON(json)
    const originalTimeline = song.getTimeline()
    const restoredTimeline = restored.getTimeline()

    expect(restoredTimeline.length).toBe(originalTimeline.length)
    for (let i = 0; i < originalTimeline.length; i++) {
      expect(restoredTimeline[i].note.pitch).toBe(originalTimeline[i].note.pitch)
      expect(restoredTimeline[i].note.duration).toBeCloseTo(originalTimeline[i].note.duration)
    }
  })

  it('round-trips multi-voice songs', () => {
    const song = new Song()
    song.voice('soprano').add('C5:q D5:q')
    song.voice('alto', { clef: 'treble' }).add('E4:q F4:q')

    const json = song.exportJSON()
    const restored = Song.fromJSON(json)
    const timeline = restored.getTimeline()

    const sopranoNotes = timeline.filter((e) => e.note.voice === 'soprano')
    const altoNotes = timeline.filter((e) => e.note.voice === 'alto')
    expect(sopranoNotes.length).toBe(2)
    expect(altoNotes.length).toBe(2)
  })

  it('exportJSON includes version field', () => {
    const song = new Song()
    song.add('C4:q')
    const json = song.exportJSON() as { version: number }
    expect(json.version).toBe(1)
  })

  it('fromJSON handles empty input gracefully', () => {
    const song = Song.fromJSON({})
    expect(song.getTimeline().length).toBe(0)
  })
})

describe('Fermata', () => {
  it('parser recognizes (fermata) notation', () => {
    const song = new Song()
    song.add('C4:w(fermata)')
    const timeline = song.getTimeline()
    // Fermata doubles duration: whole at 120 BPM = 2s, with fermata = 4s
    expect(timeline[0].note.duration).toBeCloseTo(4.0)
  })

  it('fermata does not affect non-fermata notes', () => {
    const song = new Song()
    song.add('C4:q D4:q(fermata) E4:q')
    const timeline = song.getTimeline()
    // C4: 0.5s (normal quarter), D4: 1.0s (fermata doubled), E4: 0.5s
    expect(timeline[0].note.duration).toBeCloseTo(0.5)
    expect(timeline[1].note.duration).toBeCloseTo(1.0)
    expect(timeline[2].note.duration).toBeCloseTo(0.5)
  })
})

describe('Repeat markers', () => {
  it('|: and :| cause repeated section in timeline', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q |: G4:q A4:q B4:q C5:q :|')

    const timeline = song.getTimeline()
    // Measure 1: 4 notes (C D E F)
    // Measure 2 (repeated): 4 notes × 2 = 8 notes (G A B C G A B C)
    // Total = 12 notes
    expect(timeline.length).toBe(12)
  })

  it('D.C. causes full replay from beginning', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q D.C.')

    const timeline = song.getTimeline()
    // 8 notes original + 8 notes da capo = 16
    expect(timeline.length).toBe(16)
  })

  it('repeat without explicit |: starts from beginning', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q :|')

    const timeline = song.getTimeline()
    // 4 notes + 4 repeated = 8
    expect(timeline.length).toBe(8)
  })
})

describe('Song.exportMIDI()', () => {
  it('produces valid MIDI file header', async () => {
    const song = new Song({ tempo: 100 })
    song.add('C4:q D4:q E4:q F4:q')
    const midi = await song.exportMIDI()

    expect(midi).toBeInstanceOf(Uint8Array)
    // MIDI file starts with MThd
    const header = String.fromCharCode(midi[0], midi[1], midi[2], midi[3])
    expect(header).toBe('MThd')
  })

  it('exports chords', async () => {
    const song = new Song()
    song.add('[C4 E4 G4]:h [F4 A4 C5]:h')
    const midi = await song.exportMIDI()
    expect(midi.length).toBeGreaterThan(0)
  })

  it('exports multi-voice songs', async () => {
    const song = new Song()
    song.voice('soprano').add('C5:q D5:q E5:q F5:q')
    song.voice('bass', { clef: 'bass' }).add('C3:h D3:h')
    const midi = await song.exportMIDI()
    expect(midi.length).toBeGreaterThan(0)
  })

  it('handles rests correctly', async () => {
    const song = new Song()
    song.add('C4:q R:q D4:q R:q')
    const midi = await song.exportMIDI()
    expect(midi.length).toBeGreaterThan(0)
  })

  it('handles dynamics as velocity', async () => {
    const song = new Song()
    song.add('C4:q(pp) D4:q(ff)')
    const midi = await song.exportMIDI()
    expect(midi.length).toBeGreaterThan(0)
  })
})
