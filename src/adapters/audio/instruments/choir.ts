import * as Tone from 'tone'
import type { InstrumentConfig } from './types.js'

/**
 * Choir instrument with a soft, vowel-like timbre.
 */
export const choir: InstrumentConfig = {
  name: 'choir',
  maxPolyphony: 8,
  createSynth() {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.3,
        decay: 0.1,
        sustain: 0.9,
        release: 2.0,
      },
      volume: -8,
    })
  },
}
