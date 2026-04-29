import * as Tone from 'tone'
import type { InstrumentConfig, InstrumentName } from './types.js'
import { piano } from './piano.js'
import { strings } from './strings.js'
import { choir } from './choir.js'

export type { InstrumentConfig, InstrumentName }

const INSTRUMENTS: Record<InstrumentName, InstrumentConfig> = {
  piano,
  strings,
  choir,
  organ: {
    name: 'organ',
    maxPolyphony: 8,
    createSynth() {
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square8' },
        envelope: {
          attack: 0.05,
          decay: 0.1,
          sustain: 0.95,
          release: 0.5,
        },
        volume: -10,
      })
    },
  },
  synth: piano, // default fallback
}

/**
 * Get an instrument configuration by name.
 * Falls back to piano if the name is unrecognized.
 */
export function getInstrument(name: string): InstrumentConfig {
  return INSTRUMENTS[name as InstrumentName] ?? piano
}
