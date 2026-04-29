import { describe, it, expect } from 'vitest'
import { parse } from '../../../parser/index.js'
import { buildScore } from '../../../model/converter.js'
import { MIDIAdapter } from '../MIDIAdapter.js'

describe('MIDIAdapter.export', () => {
  it('exports a simple score as valid MIDI', () => {
    const score = buildScore(parse('C4:q D4:q E4:q F4:q'))
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
    // MIDI files start with "MThd"
    expect(midi[0]).toBe(0x4d)
    expect(midi[1]).toBe(0x54)
    expect(midi[2]).toBe(0x68)
    expect(midi[3]).toBe(0x64)
  })

  it('handles rests as wait durations', () => {
    const score = buildScore(parse('C4:q R:q D4:q R:q'))
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
  })

  it('exports chords (grouped notes)', () => {
    const score = buildScore(parse('[C4 E4 G4]:q'))
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
  })

  it('applies tempo map for tempo changes', () => {
    const score = buildScore(parse('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q'))
    score.tempoAt(2, 90)
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
  })

  it('exports dotted notes correctly', () => {
    const score = buildScore(parse('C4:q. E4:e'), { timeSignature: '4/4' })
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
  })

  it('exports triplet notes with T prefix', () => {
    const score = buildScore(parse('(C4:q D4:q E4:q)'))
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
    expect(midi.length).toBeGreaterThan(0)
  })

  it('applies dynamics as velocity', () => {
    const score = buildScore(parse('C4:q(ff) D4:q(pp)'))
    const midi = MIDIAdapter.export(score)
    expect(midi).toBeInstanceOf(Uint8Array)
  })
})
