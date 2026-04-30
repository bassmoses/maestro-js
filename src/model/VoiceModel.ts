import { Note } from './Note.js'
import { Measure, TimeSignature } from './Measure.js'
import { DURATION_BEATS, durationToBeats } from './Duration.js'
import type { DurationName, NoteData } from './types.js'

export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor'

// Durations ordered large → small for splitting
const SPLIT_DURATIONS: DurationName[] = ['w', 'h', 'q', 'e', 's', 't']

/**
 * Find the largest duration that fits within the given beats.
 * Returns the duration name and whether it should be dotted.
 */
function fitDuration(beats: number): { duration: DurationName; dotted: boolean } | null {
  // Try dotted first (larger), then plain
  for (const dur of SPLIT_DURATIONS) {
    const dottedBeats = DURATION_BEATS[dur] * 1.5
    if (dottedBeats <= beats + 1e-9) {
      return { duration: dur, dotted: true }
    }
    const plainBeats = DURATION_BEATS[dur]
    if (plainBeats <= beats + 1e-9) {
      return { duration: dur, dotted: false }
    }
  }
  return null
}

export class VoiceModel {
  readonly name: string
  readonly clef: Clef
  private measures: Measure[]
  private _currentChordGroup: number = -1

  constructor(name: string, clef: Clef) {
    this.name = name
    this.clef = clef
    this.measures = []
  }

  /**
   * Add a note, auto-creating measures as needed.
   * Chord notes after the first in a group don't advance time.
   * Notes that overflow the measure are auto-split with ties.
   */
  addNote(note: Note, timeSignature: TimeSignature): void {
    // Chord continuation notes (same group) bypass fullness check
    // — they share time with the first note of their group
    if (note.chord && note.chordGroup != null && note.chordGroup === this._currentChordGroup) {
      const current = this.measures[this.measures.length - 1]
      if (!current) {
        // No measure exists yet — fall through to normal logic
      } else {
        current.addNote(note, false)
        return
      }
    }

    let current = this.measures[this.measures.length - 1]

    if (!current || current.isFull) {
      current = new Measure(timeSignature)
      this.measures.push(current)
      this._currentChordGroup = -1
    }

    // First note of a new chord group
    if (note.chord && note.chordGroup != null) {
      this._currentChordGroup = note.chordGroup
      if (note.beats > current.beatsRemaining + 1e-9) {
        this.splitNoteAcrossMeasures(note, timeSignature)
        return
      }
      current.addNote(note, true)
      return
    }

    // Non-chord note — reset chord tracking
    this._currentChordGroup = -1

    // If note fits, add it directly
    if (note.beats <= current.beatsRemaining + 1e-9) {
      current.addNote(note, true)
      return
    }

    // Auto-split: note overflows the current measure
    this.splitNoteAcrossMeasures(note, timeSignature)
  }

  /**
   * Split a note that doesn't fit in the current measure.
   * Creates tied notes across measure boundaries.
   */
  private splitNoteAcrossMeasures(note: Note, timeSignature: TimeSignature): void {
    let remainingBeats = note.beats
    let isFirst = true

    while (remainingBeats > 1e-9) {
      let current = this.measures[this.measures.length - 1]
      if (!current || current.isFull) {
        current = new Measure(timeSignature)
        this.measures.push(current)
      }

      const available = current.beatsRemaining
      const useBeats = Math.min(remainingBeats, available)
      const fit = fitDuration(useBeats)
      if (!fit) break // safety — shouldn't happen

      const splitData: NoteData = {
        pitch: note.pitch,
        accidental: note.accidental,
        octave: note.octave,
        duration: fit.duration,
        dotted: fit.dotted,
        dynamic: isFirst ? note.dynamic : null,
        tied: remainingBeats - durationToBeats(fit.duration, fit.dotted) > 1e-9, // tie if more fragments follow
        slurred: note.slurred,
        chord: note.chord,
        chordGroup: note.chordGroup,
        fermata: note.fermata,
        lyric: isFirst ? note.lyric : undefined,
      }

      const splitNote = new Note(splitData)
      current.addNote(splitNote, true)
      remainingBeats -= splitNote.beats
      isFirst = false
    }
  }

  getMeasures(): readonly Measure[] {
    return this.measures
  }

  getAllNotes(): readonly Note[] {
    return this.measures.flatMap((m) => Array.from(m.getNotes()))
  }
}
