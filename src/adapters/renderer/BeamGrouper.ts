import type { Note } from '../../model/Note.js'
import type { DurationName } from '../../model/types.js'

/**
 * Groups of notes that should be beamed together.
 * VexFlow beams groups of eighth notes and shorter within a beat.
 */
export interface BeamGroup {
  startIndex: number
  endIndex: number
}

// Durations that can be beamed (eighth and shorter)
const BEAMABLE_DURATIONS: Set<DurationName> = new Set(['e', 's', 't'])

/**
 * Determine which notes in a measure should be beamed together.
 * Rules:
 * - Only eighth notes and shorter are beamed
 * - Rests break beam groups
 * - Beam groups align to beats based on time signature
 * - A group needs at least 2 notes
 */
export function findBeamGroups(notes: readonly Note[], beatsPerMeasure: number): BeamGroup[] {
  const groups: BeamGroup[] = []
  let groupStart = -1
  let currentBeat = 0
  const beatBoundary = beatsPerMeasure > 3 ? 2 : beatsPerMeasure // group by 2 beats in 4/4, full measure in 3/4

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const isBeamable = BEAMABLE_DURATIONS.has(note.duration) && !note.isRest

    if (isBeamable) {
      if (groupStart === -1) {
        groupStart = i
      }
    } else {
      // Non-beamable note breaks the group
      if (groupStart !== -1 && i - groupStart >= 2) {
        groups.push({ startIndex: groupStart, endIndex: i - 1 })
      }
      groupStart = -1
    }

    // Beat boundary check — break beam groups at beat boundaries
    const nextBeat = currentBeat + note.beats
    const crossesBoundary =
      Math.floor(currentBeat / beatBoundary) !== Math.floor((nextBeat - 0.001) / beatBoundary)

    if (crossesBoundary && groupStart !== -1 && i > groupStart) {
      // Close current group at this boundary
      groups.push({ startIndex: groupStart, endIndex: i })
      groupStart = -1
    }

    currentBeat = nextBeat
  }

  // Close any trailing group
  if (groupStart !== -1 && notes.length - 1 - groupStart >= 1) {
    groups.push({ startIndex: groupStart, endIndex: notes.length - 1 })
  }

  return groups
}
