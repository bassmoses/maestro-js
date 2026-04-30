import { describe, it, expect } from 'vitest'
import { ScoreJSONAdapter, type ScoreJSON } from '../ScoreJSONAdapter.js'
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'
import type { NoteData } from '../../../model/types.js'

function makeNote(overrides: Partial<NoteData> = {}): Note {
  return new Note({
    pitch: 'C',
    accidental: null,
    octave: 4,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    chord: false,
    ...overrides,
  })
}

describe('ScoreJSONAdapter', () => {
  describe('toJSON', () => {
    it('exports a simple score', () => {
      const score = new Score({ tempo: 100, timeSignature: '4/4', key: 'C', title: 'Test' })
      const part = score.addPart('default')
      const voice = part.addVoice('melody', 'treble')

      voice.addNote(makeNote({ pitch: 'C', octave: 4, duration: 'q' }), score.timeSignature)
      voice.addNote(makeNote({ pitch: 'D', octave: 4, duration: 'q' }), score.timeSignature)

      const json = ScoreJSONAdapter.toJSON(score)

      expect(json.version).toBe(1)
      expect(json.settings.tempo).toBe(100)
      expect(json.settings.key).toBe('C')
      expect(json.metadata.title).toBe('Test')
      expect(json.parts).toHaveLength(1)
      expect(json.parts[0].voices).toHaveLength(1)
      expect(json.parts[0].voices[0].measures[0].notes).toHaveLength(2)
      expect(json.parts[0].voices[0].measures[0].notes[0].pitch).toBe('C')
      expect(json.parts[0].voices[0].measures[0].notes[1].pitch).toBe('D')
    })

    it('exports lyrics', () => {
      const score = new Score()
      const part = score.addPart('default')
      const voice = part.addVoice('vocal', 'treble')

      voice.addNote(makeNote({ lyric: 'hello' }), score.timeSignature)

      const json = ScoreJSONAdapter.toJSON(score)
      expect(json.parts[0].voices[0].measures[0].notes[0].lyric).toBe('hello')
    })

    it('exports tempo changes', () => {
      const score = new Score({ tempo: 120 })
      score.tempoAt(3, 80)
      score.addPart('p').addVoice('v', 'treble')

      const json = ScoreJSONAdapter.toJSON(score)
      expect(json.tempoChanges).toEqual([{ measure: 3, bpm: 80 }])
    })

    it('exports repeat sections', () => {
      const score = new Score()
      score.addRepeatSection(2, 4)
      score.addPart('p').addVoice('v', 'treble')

      const json = ScoreJSONAdapter.toJSON(score)
      expect(json.repeats).toEqual([{ startMeasure: 2, endMeasure: 4 }])
    })

    it('exports da capo', () => {
      const score = new Score()
      score.setDaCapo(true)
      score.addPart('p').addVoice('v', 'treble')

      const json = ScoreJSONAdapter.toJSON(score)
      expect(json.daCapo).toBe(true)
    })
  })

  describe('fromJSON', () => {
    it('round-trips a simple score', () => {
      const score = new Score({ tempo: 90, timeSignature: '3/4', key: 'G', title: 'Waltz' })
      const part = score.addPart('default')
      const voice = part.addVoice('melody', 'treble')

      voice.addNote(makeNote({ pitch: 'G', octave: 4, duration: 'q' }), score.timeSignature)
      voice.addNote(makeNote({ pitch: 'A', octave: 4, duration: 'q' }), score.timeSignature)
      voice.addNote(makeNote({ pitch: 'B', octave: 4, duration: 'q' }), score.timeSignature)

      const json = ScoreJSONAdapter.toJSON(score)
      const restored = ScoreJSONAdapter.fromJSON(json)

      expect(restored.tempo).toBe(90)
      expect(restored.key).toBe('G')
      expect(restored.title).toBe('Waltz')

      const parts = restored.getParts()
      expect(parts).toHaveLength(1)
      const voices = parts[0].getVoices()
      expect(voices).toHaveLength(1)
      const measures = voices[0].getMeasures()
      expect(measures).toHaveLength(1)
      expect(measures[0].getNotes()).toHaveLength(3)
    })

    it('round-trips lyrics', () => {
      const score = new Score()
      const part = score.addPart('default')
      const voice = part.addVoice('vocal', 'treble')
      voice.addNote(makeNote({ lyric: 'la' }), score.timeSignature)
      voice.addNote(makeNote({ lyric: 'di' }), score.timeSignature)

      const json = ScoreJSONAdapter.toJSON(score)
      const restored = ScoreJSONAdapter.fromJSON(json)

      const notes = restored.getParts()[0].getVoices()[0].getMeasures()[0].getNotes()
      expect(notes[0].lyric).toBe('la')
      expect(notes[1].lyric).toBe('di')
    })

    it('round-trips tempo changes', () => {
      const score = new Score({ tempo: 120 })
      score.tempoAt(2, 100)
      score.addPart('p').addVoice('v', 'treble')

      const json = ScoreJSONAdapter.toJSON(score)
      const restored = ScoreJSONAdapter.fromJSON(json)

      expect(restored.getTempoAtMeasure(2)).toBe(100)
    })

    it('rejects unsupported version', () => {
      const badJson = { version: 99 } as unknown as ScoreJSON
      expect(() => ScoreJSONAdapter.fromJSON(badJson)).toThrow('Unsupported ScoreJSON version')
    })
  })
})
