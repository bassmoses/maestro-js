import { describe, it, expect, vi } from 'vitest'

// Mock Tone.js
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
      schedule: vi.fn(),
      seconds: 0,
    })),
    getContext: vi.fn(() => ({ state: 'running' })),
    start: vi.fn(),
  }
})

import { getInstrument } from '../instruments/index.js'
import type { InstrumentName } from '../instruments/types.js'

describe('Instruments', () => {
  const instrumentNames: InstrumentName[] = ['piano', 'strings', 'choir', 'organ', 'synth']

  for (const name of instrumentNames) {
    describe(name, () => {
      it(`should return a valid config for "${name}"`, () => {
        const config = getInstrument(name)
        expect(config.name).toBeTruthy()
        expect(config.maxPolyphony).toBeGreaterThan(0)
        expect(typeof config.createSynth).toBe('function')
      })

      it(`should create a synth instance for "${name}"`, () => {
        const config = getInstrument(name)
        const synth = config.createSynth()
        expect(synth).toBeDefined()
      })
    })
  }

  it('should fall back to piano for unknown instruments', () => {
    const config = getInstrument('unknown-instrument')
    expect(config.name).toBe('piano')
  })

  it('should have synth as an alias for piano', () => {
    const synth = getInstrument('synth')
    const piano = getInstrument('piano')
    expect(synth.name).toBe(piano.name)
  })
})
