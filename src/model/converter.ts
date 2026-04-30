import type { NoteNode } from '../parser/types.js'
import { Score, ScoreOptions } from './Score.js'
import { Note } from './Note.js'
import { NoteData } from './types.js'

/**
 * Convert a single NoteNode to a Note model object.
 */
export function nodeToNote(node: NoteNode): Note {
  const noteData: NoteData = {
    pitch: node.pitch ?? 'R',
    accidental: node.accidental,
    octave: node.octave ?? 4,
    duration: node.duration,
    dotted: node.dotted,
    dynamic: node.dynamic,
    tied: node.tied,
    slurred: node.slurred,
    chord: node.chord,
    chordGroup: node.chordGroup,
    fermata: node.fermata,
    triplet: node.triplet,
    lyric: node.lyric,
  }
  return new Note(noteData)
}

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

    const note = nodeToNote(node)
    voice.addNote(note, score.timeSignature)
  }

  return score
}
