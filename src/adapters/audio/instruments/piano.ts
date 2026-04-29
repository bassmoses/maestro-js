import * as Tone from 'tone'
import type { InstrumentConfig } from './types.js'

/**
 * Piano instrument using Tone.js PolySynth with a piano-like envelope.
 * Uses a simple synth as a zero-dependency fallback (no sample loading).
 */
export const piano: InstrumentConfig = {
  name: 'piano',
  maxPolyphony: 10,
  createSynth() {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.2,
        release: 1.0,
      },
      volume: -6,
    })
  },
}
