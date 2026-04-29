import * as Tone from 'tone'
import type { InstrumentConfig } from './types.js'

/**
 * Strings instrument with a warm, sustained timbre.
 */
export const strings: InstrumentConfig = {
  name: 'strings',
  maxPolyphony: 8,
  createSynth() {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.15,
        decay: 0.2,
        sustain: 0.8,
        release: 1.5,
      },
      volume: -8,
    })
  },
}
