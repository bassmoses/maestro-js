import type { NoteNode, ValidationError, DurationName } from './types.js'
import { VALID_PITCH_NAMES, VALID_DURATION_CHARS, VALID_DYNAMIC_NAMES } from './constants.js'

const VALID_PITCHES = VALID_PITCH_NAMES
const VALID_DURATIONS = VALID_DURATION_CHARS
const VALID_DYNAMICS = VALID_DYNAMIC_NAMES

const DURATION_BEATS: Record<DurationName, number> = {
  w: 4,
  h: 2,
  q: 1,
  e: 0.5,
  s: 0.25,
  t: 0.125,
}

const NOTE_VALUE_MAP: Record<string, DurationName> = {
  '1': 'w',
  '2': 'h',
  '4': 'q',
  '8': 'e',
  '16': 's',
  '32': 't',
}

function parseTimeSignature(ts: string): { beatsPerMeasure: number } | null {
  const parts = ts.split('/')
  if (parts.length !== 2) return null
  const beats = parseInt(parts[0], 10)
  const noteValue = NOTE_VALUE_MAP[parts[1]]
  if (isNaN(beats) || !noteValue) return null
  // Calculate capacity in quarter-note beats
  const noteBeats = DURATION_BEATS[noteValue]
  return { beatsPerMeasure: beats * noteBeats }
}

function nodeBeats(node: NoteNode): number {
  const base = DURATION_BEATS[node.duration]
  return node.dotted ? base * 1.5 : base
}

export function validate(nodes: NoteNode[], timeSignature?: string): ValidationError[] {
  const errors: ValidationError[] = []

  for (const node of nodes) {
    // Skip barlines for most validation
    if (node.isBarline) continue

    // Validate pitch for note nodes
    if (node.type === 'note' && node.pitch !== null) {
      if (!VALID_PITCHES.has(node.pitch)) {
        errors.push({
          message: `"${node.pitch}" is not a valid note name. Valid notes are: C D E F G A B`,
        })
      }
    }

    // Validate duration
    if (!VALID_DURATIONS.has(node.duration)) {
      errors.push({
        message: `"${node.duration}" is not a valid duration. Valid durations are: w h q e s t`,
      })
    }

    // Validate dynamic
    if (node.dynamic !== null && !VALID_DYNAMICS.has(node.dynamic)) {
      errors.push({
        message: `"${node.dynamic}" is not a valid dynamic. Valid dynamics are: ppp pp p mp mf f ff fff cresc decresc`,
      })
    }

    // Validate octave range (0–8)
    if (node.octave !== null && (node.octave < 0 || node.octave > 8)) {
      errors.push({
        message: `Octave ${node.octave} is out of range. Valid octaves are 0–8.`,
      })
    }
  }

  // Time signature validation
  if (timeSignature) {
    const tsInfo = parseTimeSignature(timeSignature)
    if (!tsInfo) {
      errors.push({ message: `Invalid time signature: "${timeSignature}"` })
    } else {
      const { beatsPerMeasure } = tsInfo
      // Split nodes into measures by barlines
      const measures: NoteNode[][] = []
      let currentMeasure: NoteNode[] = []

      for (const node of nodes) {
        if (node.isBarline) {
          measures.push(currentMeasure)
          currentMeasure = []
        } else {
          currentMeasure.push(node)
        }
      }
      // Last measure (no trailing barline required)
      measures.push(currentMeasure)

      for (let m = 0; m < measures.length; m++) {
        const measure = measures[m]
        if (measure.length === 0) continue

        // Count beats correctly:
        // - Chord notes in the same chordGroup share time (only count once per group)
        // - Triplet notes are counted as their raw beats * (2/3) per group
        let totalBeats = 0
        const seenChordGroups = new Set<number>()
        const seenTripletGroups = new Set<number>()
        const tripletGroupBeats = new Map<number, number>()

        for (const node of measure) {
          if (node.isBarline) continue

          if (node.triplet) {
            if (node.tripletGroup == null) continue
            if (!seenTripletGroups.has(node.tripletGroup)) {
              seenTripletGroups.add(node.tripletGroup)
            }
            // Accumulate beats per triplet group
            const key = node.tripletGroup
            tripletGroupBeats.set(key, (tripletGroupBeats.get(key) ?? 0) + nodeBeats(node))
          } else if (node.chord) {
            const group = node.chordGroup
            if (group !== undefined && !seenChordGroups.has(group)) {
              totalBeats += nodeBeats(node)
              seenChordGroups.add(group)
            } else if (group === undefined) {
              // Legacy: no chordGroup, count only first in contiguous chord sequence
              totalBeats += nodeBeats(node)
            }
          } else {
            totalBeats += nodeBeats(node)
          }
        }

        // Add triplet group beats (raw beats * 2/3 per group)
        for (const rawBeats of tripletGroupBeats.values()) {
          totalBeats += rawBeats * (2 / 3)
        }

        const tolerance = 1e-9
        if (totalBeats > beatsPerMeasure + tolerance) {
          errors.push({
            message: `Measure ${m + 1} overflows the time signature ${timeSignature}: ${totalBeats} beats exceeds ${beatsPerMeasure}`,
            measure: m + 1,
          })
        } else if (totalBeats < beatsPerMeasure - tolerance) {
          errors.push({
            message: `Measure ${m + 1} is underfilled: ${totalBeats} beats is less than ${beatsPerMeasure}`,
            measure: m + 1,
            severity: 'warning',
          })
        }
      }
    }
  }

  return errors
}
