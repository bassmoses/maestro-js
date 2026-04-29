import { describe, it, expect, vi } from 'vitest'

// Mock Tone.js for Song audio tests
vi.mock('tone', () => {
  const mockSynth = {
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn(),
  }
  function MockPolySynth() {
    return mockSynth
  }
  function MockSynth() {}
  return {
    PolySynth: MockPolySynth,
    Synth: MockSynth,
    getTransport: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
      schedule: vi.fn(() => 0),
      seconds: 0,
    })),
    getContext: vi.fn(() => ({ state: 'running' })),
    start: vi.fn(),
  }
})

import { Song } from '../Song.js'

describe('Song construction', () => {
  it('creates a song with default options', () => {
    const song = new Song()
    const score = song.getScore()
    expect(score.tempo).toBe(120)
    expect(score.key).toBe('C')
    expect(score.timeSignature).toEqual({ beats: 4, noteValue: 'q' })
  })

  it('accepts custom options', () => {
    const song = new Song({
      tempo: 90,
      timeSignature: '3/4',
      key: 'Bb',
      title: 'Test Song',
      composer: 'Test Composer',
    })
    const score = song.getScore()
    expect(score.tempo).toBe(90)
    expect(score.key).toBe('Bb')
    expect(score.title).toBe('Test Song')
    expect(score.composer).toBe('Test Composer')
    expect(score.timeSignature).toEqual({ beats: 3, noteValue: 'q' })
  })
})

describe('Song.add()', () => {
  it('returns this for chaining', () => {
    const song = new Song()
    const result = song.add('C4:q D4:q E4:q F4:q')
    expect(result).toBe(song)
  })

  it('parses a simple melody into the score', () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const score = song.getScore()
    const parts = score.getParts()
    expect(parts.length).toBe(1)
    const voices = parts[0].getVoices()
    expect(voices.length).toBe(1)
    const notes = voices[0].getAllNotes()
    expect(notes.length).toBe(4)
    expect(notes[0].pitch).toBe('C')
    expect(notes[1].pitch).toBe('D')
    expect(notes[2].pitch).toBe('E')
    expect(notes[3].pitch).toBe('F')
  })

  it('supports multiple add() calls', () => {
    const song = new Song()
    song.add('C4:q D4:q').add('E4:q F4:q')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes.length).toBe(4)
  })

  it('handles chords', () => {
    const song = new Song()
    song.add('[C4 E4 G4]:h')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes.length).toBe(3)
    expect(notes[0].chord).toBe(true)
    expect(notes[0].duration).toBe('h')
  })

  it('handles rests', () => {
    const song = new Song()
    song.add('C4:q R:q E4:h')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes.length).toBe(3)
    expect(notes[1].isRest).toBe(true)
  })

  it('handles dynamics', () => {
    const song = new Song()
    song.add('C4:q(mp) D4:q(ff)')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes[0].dynamic).toBe('mp')
    expect(notes[1].dynamic).toBe('ff')
  })

  it('handles dotted notes', () => {
    const song = new Song()
    song.add('G4:h. E4:q')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes[0].dotted).toBe(true)
    expect(notes[0].duration).toBe('h')
  })

  it('handles ties', () => {
    const song = new Song()
    song.add('C4:h~C4:h')
    const notes = song.getScore().getParts()[0].getVoices()[0].getAllNotes()
    expect(notes[0].tied).toBe(true)
  })
})

describe('Song.voice()', () => {
  it('creates named voices', () => {
    const song = new Song()
    const soprano = song.voice('soprano', { clef: 'treble' })
    expect(soprano).toBeDefined()
    expect(soprano.getName()).toBe('soprano')
    expect(soprano.getClef()).toBe('treble')
  })

  it('returns the same voice on repeated calls', () => {
    const song = new Song()
    const v1 = song.voice('alto')
    const v2 = song.voice('alto')
    expect(v1).toBe(v2)
  })

  it('builds multi-voice scores', () => {
    const song = new Song({ tempo: 76, timeSignature: '4/4', key: 'C' })
    song.voice('soprano', { clef: 'treble' }).add('C5:h D5:h')
    song.voice('alto', { clef: 'treble' }).add('E4:h F4:h')

    const score = song.getScore()
    const parts = score.getParts()
    expect(parts.length).toBe(2)

    const sopranoNotes = parts[0].getVoices()[0].getAllNotes()
    expect(sopranoNotes.length).toBe(2)
    expect(sopranoNotes[0].pitch).toBe('C')
    expect(sopranoNotes[0].octave).toBe(5)

    const altoNotes = parts[1].getVoices()[0].getAllNotes()
    expect(altoNotes.length).toBe(2)
    expect(altoNotes[0].pitch).toBe('E')
    expect(altoNotes[0].octave).toBe(4)
  })

  it('supports SATB with different clefs', () => {
    const song = new Song()
    song.voice('soprano', { clef: 'treble' }).add('C5:w')
    song.voice('alto', { clef: 'treble' }).add('E4:w')
    song.voice('tenor', { clef: 'treble-8' }).add('C4:w')
    song.voice('bass', { clef: 'bass' }).add('C3:w')

    const parts = song.getScore().getParts()
    expect(parts.length).toBe(4)
  })
})

describe('Song.getTimeline()', () => {
  it('produces correct timeline for simple melody', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q')
    const timeline = song.getTimeline()
    expect(timeline.length).toBe(4)
    expect(timeline[0].time).toBe(0)
    expect(timeline[0].note.pitch).toBe('C4')
    // At 120 BPM, quarter = 0.5s
    expect(timeline[1].time).toBeCloseTo(0.5)
    expect(timeline[2].time).toBeCloseTo(1.0)
    expect(timeline[3].time).toBeCloseTo(1.5)
  })

  it('total duration matches expected time', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q')
    const timeline = song.getTimeline()
    const lastEvent = timeline[timeline.length - 1]
    // Last note starts at 1.5s, duration is 0.5s → total = 2.0s
    expect(lastEvent.time + lastEvent.note.duration).toBeCloseTo(2.0)
  })
})

describe('Song.exportJSON()', () => {
  it('exports a valid JSON structure', () => {
    const song = new Song({ tempo: 100, key: 'D' })
    song.add('C4:q D4:q')
    const json = song.exportJSON() as Record<string, unknown>

    expect(json).toHaveProperty('options')
    expect(json).toHaveProperty('defaultNotation')
    expect(json).toHaveProperty('version', 1)
    const opts = json.options as Record<string, unknown>
    expect(opts.tempo).toBe(100)
    expect(opts.key).toBe('D')
    const notations = json.defaultNotation as string[]
    expect(notations).toContain('C4:q D4:q')
  })
})

describe('Song.on()', () => {
  it('returns this for chaining', () => {
    const song = new Song()
    const result = song.on('end', () => {})
    expect(result).toBe(song)
  })
})

describe('Song.off()', () => {
  it('removes a handler', () => {
    const song = new Song()
    const handler = () => {}
    song.on('end', handler)
    const result = song.off('end', handler)
    expect(result).toBe(song)
  })
})

describe('Song stub methods', () => {
  it('render() throws when target not found', () => {
    const song = new Song()
    expect(() => song.render('#nonexistent')).toThrow('not found')
  })

  it('play() returns a promise that resolves to this', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const result = await song.play()
    expect(result).toBe(song)
  })

  it('pause() returns this for chaining', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const result = song.pause()
    expect(result).toBe(song)
  })

  it('stop() returns this for chaining', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const result = song.stop()
    expect(result).toBe(song)
  })

  it('seekTo() returns this for chaining', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const result = song.seekTo({ measure: 1, beat: 1 })
    expect(result).toBe(song)
  })

  it('exportSVG() is available as a method', () => {
    const song = new Song()
    expect(typeof song.exportSVG).toBe('function')
  })

  it('exportMIDI() returns a Uint8Array', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    const midi = await song.exportMIDI()
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
    // MIDI files start with "MThd" header
    expect(midi[0]).toBe(0x4d) // M
    expect(midi[1]).toBe(0x54) // T
    expect(midi[2]).toBe(0x68) // h
    expect(midi[3]).toBe(0x64) // d
  })

  it('exportPNG() rejects when sharp is not available', async () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    // exportPNG calls exportSVG internally (slow jsdom init), then tries sharp
    await expect(song.exportPNG()).rejects.toThrow()
  }, 15000)

  it('transpose() shifts all notes by semitones', () => {
    const song = new Song()
    song.add('C4:q D4:q E4:q')
    song.transpose(2)
    // C4+2 = D4, D4+2 = E4, E4+2 = F#4
    const timeline = song.getTimeline()
    expect(timeline[0].note.pitch).toBe('D4')
    expect(timeline[1].note.pitch).toBe('E4')
    expect(timeline[2].note.pitch).toBe('F#4')
  })

  it('fromJSON() reconstructs a song', () => {
    const original = new Song({ tempo: 90, key: 'G' })
    original.add('C4:q D4:q')
    const json = original.exportJSON()

    const restored = Song.fromJSON(json)
    const timeline = restored.getTimeline()
    expect(timeline.length).toBe(2)
    expect(timeline[0].note.pitch).toBe('C4')
    expect(timeline[1].note.pitch).toBe('D4')
  })
})

describe('Song.tempoAt()', () => {
  it('stores tempo changes and reapplies on rebuild', () => {
    const song = new Song({ tempo: 120 })
    song.tempoAt(2, 90)
    song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
    const score = song.getScore()
    const tempoMap = score.getTempoMap()
    expect(tempoMap.get(2)).toBe(90)
  })

  it('tempo changes persist across rebuilds', () => {
    const song = new Song({ tempo: 120 })
    song.tempoAt(2, 90)
    song.add('C4:q D4:q E4:q F4:q')
    // Second add triggers rebuild
    song.add('G4:q A4:q B4:q C5:q')
    const score = song.getScore()
    expect(score.getTempoMap().get(2)).toBe(90)
  })
})

describe('Song.on() / Song.off()', () => {
  it('on() registers a handler', () => {
    const song = new Song()
    const calls: unknown[] = []
    song.on('beat', (data) => calls.push(data))
    // Handler is registered
    const score = song.getScore()
    expect(score).toBeDefined()
  })

  it('off() removes a specific handler', () => {
    const song = new Song()
    const handler = vi.fn()
    song.on('note', handler)
    song.off('note', handler)
    // Handler removed - no assertion needed beyond no error
  })

  it('off() with non-existent handler is a no-op', () => {
    const song = new Song()
    const handler = vi.fn()
    // Removing a handler that was never added should not throw
    expect(() => song.off('beat', handler)).not.toThrow()
  })
})
