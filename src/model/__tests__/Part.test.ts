import { describe, it, expect, beforeEach } from 'vitest'
import { Part } from '../Part.js'

describe('Part', () => {
  let part: Part

  beforeEach(() => {
    part = new Part('Strings')
  })

  it('has correct name', () => {
    expect(part.name).toBe('Strings')
  })

  it('starts with no voices', () => {
    expect(part.getVoices()).toHaveLength(0)
  })

  it('addVoice creates a voice', () => {
    const v = part.addVoice('soprano', 'treble')
    expect(v).toBeDefined()
    expect(v.name).toBe('soprano')
    expect(v.clef).toBe('treble')
  })

  it('getVoice returns the added voice', () => {
    part.addVoice('soprano', 'treble')
    const v = part.getVoice('soprano')
    expect(v).toBeDefined()
    expect(v!.name).toBe('soprano')
  })

  it('getVoice returns undefined for unknown voice', () => {
    expect(part.getVoice('nobody')).toBeUndefined()
  })

  it('getVoices returns all voices', () => {
    part.addVoice('soprano', 'treble')
    part.addVoice('alto', 'treble')
    part.addVoice('bass', 'bass')
    expect(part.getVoices()).toHaveLength(3)
  })

  it('supports all clef types via addVoice', () => {
    const clefs = ['treble', 'bass', 'treble-8', 'alto', 'tenor'] as const
    clefs.forEach((clef) => {
      const v = part.addVoice(`voice-${clef}`, clef)
      expect(v.clef).toBe(clef)
    })
    expect(part.getVoices()).toHaveLength(clefs.length)
  })

  it('throws if voice with same name added twice', () => {
    const part = new Part('Choir')
    part.addVoice('soprano', 'treble')
    expect(() => part.addVoice('soprano', 'treble')).toThrow('Voice "soprano" already exists')
  })
})
