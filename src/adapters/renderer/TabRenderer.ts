/**
 * TabRenderer — tablature pitch-to-fret algorithm and VexFlow TabStave/TabNote builder.
 *
 * Tuning arrays store MIDI note numbers of open strings,
 * ordered from LOWEST string to HIGHEST (index 0 = lowest string).
 */

/** MIDI note numbers of open strings ordered lowest to highest (index 0 = lowest). */
export type Tuning = readonly number[]

export const TUNINGS: Record<string, Tuning> = {
  /** Standard guitar: E2 A2 D3 G3 B3 E4 */
  guitar: [40, 45, 50, 55, 59, 64],
  /** Drop D guitar: D2 A2 D3 G3 B3 E4 */
  dropD: [38, 45, 50, 55, 59, 64],
  /** Standard bass: E1 A1 D2 G2 */
  bass: [28, 33, 38, 43],
  /** Mandolin: G3 D4 A4 E5 */
  mandolin: [55, 62, 69, 76],
}

export interface FretPosition {
  /**
   * 1-based string number counting from the HIGHEST string.
   * String 1 = highest pitch string, String N = lowest pitch string.
   * (Matches standard guitar tab notation conventions.)
   */
  string: number
  fret: number
}

/**
 * Find the best (lowest fret) position for a given MIDI pitch on a given tuning.
 *
 * Algorithm:
 * 1. For each string (from highest to lowest), compute fret = midi - openMidi.
 * 2. Discard positions where fret < 0 or fret > 24.
 * 3. Return the position with the lowest fret. Ties broken by preferring
 *    the string with the smaller 1-based string number (higher-pitched string).
 */
export function pitchToFret(midi: number, tuning: Tuning): FretPosition {
  const numStrings = tuning.length
  let bestFret = Infinity
  let bestString = 1

  for (let i = 0; i < numStrings; i++) {
    // Convert tuning index (0 = lowest) to conventional string number (1 = highest)
    const stringNumber = numStrings - i
    const openMidi = tuning[i]
    const fret = midi - openMidi
    if (fret >= 0 && fret <= 24) {
      if (fret < bestFret || (fret === bestFret && stringNumber < bestString)) {
        bestFret = fret
        bestString = stringNumber
      }
    }
  }

  if (bestFret === Infinity) {
    return { string: 1, fret: 0 }
  }

  return { string: bestString, fret: bestFret }
}

/**
 * Build VexFlow TabNote position objects from an array of MIDI pitches and a tuning.
 * Returns an array of { str, fret } objects for `new TabNote({ positions: [...] })`.
 *
 * Called only from VexFlowAdapter at runtime (not testable in jsdom).
 */
export function midiToTabPositions(
  midis: number[],
  tuning: Tuning
): Array<{ str: number; fret: number }> {
  return midis.map((midi) => {
    const pos = pitchToFret(midi, tuning)
    return { str: pos.string, fret: pos.fret }
  })
}
