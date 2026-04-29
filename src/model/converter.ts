import type { NoteNode } from '../parser/types.js'
import { Score, ScoreOptions } from './Score.js'
import { Note } from './Note.js'
import { NoteData } from './types.js'

/**
 * Convert an array of NoteNodes (from the parser) into a Score model.
 * Creates a single default Part with a single default treble-clef Voice.
 * Barline nodes are skipped; all other nodes are converted to Notes and
 * added in sequence (VoiceModel handles measure boundaries automatically).
 */
export function buildScore(nodes: NoteNode[], options?: Partial<ScoreOptions>): Score {
  const score = new Score(options)

  const part = score.addPart('default')
  const voice = part.addVoice('default', 'treble')

  for (const node of nodes) {
    // Skip barline marker nodes
    if (node.isBarline) continue

    const noteData: NoteData = {
      pitch: node.pitch ?? 'R', // null pitch → rest
      accidental: node.accidental,
      octave: node.octave ?? 4, // null octave (rest) → middle C octave
      duration: node.duration,
      dotted: node.dotted,
      dynamic: node.dynamic,
      tied: node.tied,
      slurred: node.slurred,
      chord: node.chord,
      chordGroup: node.chordGroup,
      triplet: node.triplet,
    }

    const note = new Note(noteData)
    voice.addNote(note, score.timeSignature)
  }

  return score
}
