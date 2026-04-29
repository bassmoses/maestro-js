import { describe, it, expect, vi } from 'vitest'
import { Voice } from '../Voice.js'
import { Song } from '../Song.js'

describe('Voice construction', () => {
  it('stores name and clef', () => {
    const song = new Song()
    const voice = new Voice('soprano', 'treble', song)
    expect(voice.getName()).toBe('soprano')
    expect(voice.getClef()).toBe('treble')
  })

  it('starts with empty notations', () => {
    const song = new Song()
    const voice = new Voice('alto', 'treble', song)
    expect(voice.getNotations()).toEqual([])
  })
})

describe('Voice.add()', () => {
  it('returns this for chaining', () => {
    const song = new Song()
    const voice = new Voice('soprano', 'treble', song)
    const result = voice.add('C4:q D4:q')
    expect(result).toBe(voice)
  })

  it('stores notation strings', () => {
    const song = new Song()
    const voice = new Voice('soprano', 'treble', song)
    voice.add('C4:q D4:q').add('E4:q F4:q')
    expect(voice.getNotations()).toEqual(['C4:q D4:q', 'E4:q F4:q'])
  })

  it('notifies the parent song on add', () => {
    const song = new Song()
    const spy = vi.spyOn(song, '_notifyVoiceChanged')
    const voice = new Voice('soprano', 'treble', song)
    voice.add('C4:q')
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('Voice via Song.voice()', () => {
  it('creates a voice and builds score when notation added', () => {
    const song = new Song()
    song.voice('soprano', { clef: 'treble' }).add('C5:h D5:h')
    const score = song.getScore()
    const part = score.getPart('soprano')
    expect(part).toBeDefined()
    const voiceModel = part!.getVoices()[0]
    expect(voiceModel.name).toBe('soprano')
    expect(voiceModel.clef).toBe('treble')
    const notes = voiceModel.getAllNotes()
    expect(notes.length).toBe(2)
  })

  it('supports chaining multiple add calls', () => {
    const song = new Song()
    song.voice('tenor', { clef: 'treble-8' }).add('C4:q D4:q').add('E4:q F4:q')
    const notes = song.getScore().getPart('tenor')!.getVoices()[0].getAllNotes()
    expect(notes.length).toBe(4)
  })

  it('defaults clef to treble', () => {
    const song = new Song()
    song.voice('test').add('C4:q')
    const v = song.getScore().getPart('test')!.getVoices()[0]
    expect(v.clef).toBe('treble')
  })
})
