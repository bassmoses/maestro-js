import { describe, it, expect } from 'vitest'
import { parse } from '../../parser/index.js'
import { buildScore } from '../converter.js'

describe('buildScore', () => {
  describe('basic structure', () => {
    it('creates exactly one part named "default"', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      expect(score.getParts()).toHaveLength(1)
      expect(score.getParts()[0].name).toBe('default')
    })

    it('default part has a voice named "default" with clef treble', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const part = score.getParts()[0]
      const voice = part.getVoice('default')
      expect(voice).toBeDefined()
      expect(voice!.clef).toBe('treble')
    })

    it('4 quarter notes in 4/4 → 1 measure', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getMeasures()).toHaveLength(1)
    })

    it('4 quarter notes in 4/4 → measure has 4 notes', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getMeasures()[0].getNotes()).toHaveLength(4)
    })

    it('notes have correct pitches', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].pitch).toBe('C')
      expect(notes[1].pitch).toBe('D')
      expect(notes[2].pitch).toBe('E')
      expect(notes[3].pitch).toBe('F')
    })

    it('notes have correct durations', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      notes.forEach((note) => expect(note.duration).toBe('q'))
    })

    it('notes have correct octaves', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      notes.forEach((note) => expect(note.octave).toBe(4))
    })
  })

  describe('barlines create new measures', () => {
    it('8 quarter notes with barline → 2 measures', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'))
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getMeasures()).toHaveLength(2)
    })

    it('first measure has 4 notes, second measure has 4 notes', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'))
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getMeasures()[0].getNotes()).toHaveLength(4)
      expect(voice.getMeasures()[1].getNotes()).toHaveLength(4)
    })

    it('barline nodes are skipped (not added as notes)', () => {
      const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'))
      const allNotes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(allNotes).toHaveLength(8)
    })
  })

  describe('rests', () => {
    it('rest node produces isRest=true note', () => {
      const score = buildScore(parse('R:h C4:h'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].isRest).toBe(true)
    })

    it('note after rest has correct pitch', () => {
      const score = buildScore(parse('R:h C4:h'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[1].pitch).toBe('C')
    })

    it('rest uses pitch R', () => {
      const score = buildScore(parse('R:h C4:h'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].pitch).toBe('R')
    })
  })

  describe('chords', () => {
    it('chord notes all have chord=true', () => {
      const score = buildScore(parse('[C4 E4 G4]:h [D4 F4 A4]:h'), { timeSignature: '4/4' })
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes).toHaveLength(6)
      notes.forEach((note) => expect(note.chord).toBe(true))
    })

    it('chord notes are in a single measure', () => {
      const score = buildScore(parse('[C4 E4 G4]:h [D4 F4 A4]:h'), { timeSignature: '4/4' })
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getMeasures()).toHaveLength(1)
    })
  })

  describe('score options', () => {
    it('tempo option is applied', () => {
      const score = buildScore(parse('G4:w'), { tempo: 90 })
      expect(score.tempo).toBe(90)
    })

    it('key option is applied', () => {
      const score = buildScore(parse('G4:w'), { key: 'G' })
      expect(score.key).toBe('G')
    })

    it('timeSignature option is applied', () => {
      const score = buildScore(parse('G4:w'), { timeSignature: '3/4' })
      expect(score.timeSignature).toEqual({ beats: 3, noteValue: 'q' })
    })

    it('combined options work together', () => {
      const score = buildScore(parse('G4:w'), { tempo: 90, key: 'G', timeSignature: '3/4' })
      expect(score.tempo).toBe(90)
      expect(score.key).toBe('G')
      expect(score.timeSignature).toEqual({ beats: 3, noteValue: 'q' })
    })

    it('title and composer options are applied', () => {
      const score = buildScore(parse('C4:q'), { title: 'Sonata', composer: 'Bach' })
      expect(score.title).toBe('Sonata')
      expect(score.composer).toBe('Bach')
    })

    it('defaults when no options given', () => {
      const score = buildScore(parse('C4:q'))
      expect(score.tempo).toBe(120)
      expect(score.key).toBe('C')
      expect(score.timeSignature).toEqual({ beats: 4, noteValue: 'q' })
    })
  })

  describe('note properties preserved', () => {
    it('dotted note has dotted=true', () => {
      const score = buildScore(parse('C4:h.'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      // dotted half note = 3 beats, so we need a time signature that fits
      expect(notes[0].dotted).toBe(true)
    })

    it('dynamic is preserved', () => {
      const score = buildScore(parse('C4:q(ff)'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].dynamic).toBe('ff')
    })

    it('accidental is preserved', () => {
      const score = buildScore(parse('F#4:q'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].accidental).toBe('#')
    })

    it('rest octave defaults to 4', () => {
      const score = buildScore(parse('R:q'))
      const notes = score.getParts()[0].getVoice('default')!.getAllNotes()
      expect(notes[0].octave).toBe(4)
    })
  })

  describe('empty input', () => {
    it('empty parse result → score with part but no notes', () => {
      const score = buildScore(parse(''))
      expect(score.getParts()).toHaveLength(1)
      const voice = score.getParts()[0].getVoice('default')!
      expect(voice.getAllNotes()).toHaveLength(0)
    })
  })
})
