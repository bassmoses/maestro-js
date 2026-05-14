import { describe, it, expect } from 'vitest'
import { MIDIAdapter } from '../MIDIAdapter.js'
import { Score } from '../../../model/Score.js'
import { Note } from '../../../model/Note.js'

function makePercussionScore(drumName: 'KICK' | 'SNARE' | 'HIHAT'): Score {
  const score = new Score({ tempo: 120, timeSignature: '4/4', key: 'C' })
  const part = score.addPart('drums')
  const voice = part.addVoice('drums', 'percussion')
  const note = new Note({
    pitch: 'C',
    accidental: null,
    octave: 4,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    chord: false,
    fermata: false,
    triplet: false,
    percussion: drumName,
  })
  voice.addNote(note, score.timeSignature)
  return score
}

describe('MIDIAdapter — percussion channel routing', () => {
  it('exports without throwing for a percussion note', () => {
    const score = makePercussionScore('SNARE')
    expect(() => MIDIAdapter.export(score)).not.toThrow()
  })
  it('produces a non-empty MIDI buffer for a percussion score', () => {
    const score = makePercussionScore('KICK')
    const buffer = MIDIAdapter.export(score)
    expect(buffer.length).toBeGreaterThan(0)
  })
  it('produces a valid MIDI file header (MThd) for a percussion score', () => {
    const score = makePercussionScore('KICK')
    const buffer = MIDIAdapter.export(score)
    // MIDI file starts with 0x4D546864 ("MThd")
    expect(buffer[0]).toBe(0x4d)
    expect(buffer[1]).toBe(0x54)
    expect(buffer[2]).toBe(0x68)
    expect(buffer[3]).toBe(0x64)
  })
})
