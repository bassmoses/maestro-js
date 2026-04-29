import type * as Tone from 'tone'

/**
 * Instrument factory types for the audio adapter.
 * Each instrument provides a function to create a Tone.js-compatible
 * polyphonic synth with appropriate timbre settings.
 */

export interface InstrumentConfig {
  name: string
  createSynth: () => Tone.PolySynth
  maxPolyphony: number
}

export type InstrumentName = 'piano' | 'strings' | 'choir' | 'organ' | 'synth'
