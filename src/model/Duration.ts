import { DurationName } from './types.js'

export const DURATION_BEATS: Record<DurationName, number> = {
  w: 4,
  h: 2,
  q: 1,
  e: 0.5,
  s: 0.25,
  t: 0.125,
}

/**
 * Convert a duration name and optional dot to total beats.
 * Dotted adds 50% of the base beat value.
 */
export function durationToBeats(dur: DurationName, dotted: boolean): number {
  const base = DURATION_BEATS[dur]
  return dotted ? base * 1.5 : base
}

/**
 * Convert beats to seconds given a BPM (quarter-note-based).
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60
}

/**
 * Parse a duration string like 'q', 'h.', 'w', 'e.' etc.
 * Returns the DurationName and whether it is dotted.
 * Throws on unrecognised strings.
 */
export function parseDuration(str: string): { duration: DurationName; dotted: boolean } {
  const validDurations = new Set<string>(['w', 'h', 'q', 'e', 's', 't'])
  const dotted = str.endsWith('.')
  const base = dotted ? str.slice(0, -1) : str

  if (!validDurations.has(base)) {
    throw new Error(`Invalid duration string: "${str}"`)
  }

  return { duration: base as DurationName, dotted }
}
