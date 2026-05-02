import { type DurationName, BEAT_EPSILON } from './types.js'
import { DURATION_BEATS } from './Duration.js'
import { Note } from './Note.js'

export interface TimeSignature {
  beats: number
  noteValue: DurationName
}

export class Measure {
  readonly timeSignature: TimeSignature
  readonly rehearsalMark: string | null
  private notes: Note[]
  private _usedBeats: number = 0

  constructor(timeSignature: TimeSignature, rehearsalMark: string | null = null) {
    this.timeSignature = timeSignature
    this.rehearsalMark = rehearsalMark
    this.notes = []
  }

  /**
   * The total beat capacity of this measure based on the time signature.
   * e.g. 4/4 => 4 beats (based on quarter note = 1 beat reference).
   */
  private get capacityBeats(): number {
    const noteBeats = DURATION_BEATS[this.timeSignature.noteValue]
    return this.timeSignature.beats * noteBeats
  }

  get totalBeats(): number {
    return this._usedBeats
  }

  get beatsRemaining(): number {
    return this.capacityBeats - this._usedBeats
  }

  get isFull(): boolean {
    return this.beatsRemaining <= BEAT_EPSILON
  }

  /**
   * Add a note to this measure.
   * If `advanceTime` is false, the note is stacked at the current position
   * (for chord notes that share the same time slot).
   */
  addNote(note: Note, advanceTime: boolean = true): void {
    if (advanceTime && note.beats > this.beatsRemaining + BEAT_EPSILON) {
      throw new Error(
        `Note (${note.beats} beats) would overflow measure ` +
          `(${this.beatsRemaining} beats remaining)`
      )
    }
    this.notes.push(note)
    if (advanceTime) {
      this._usedBeats += note.beats
    }
  }

  getNotes(): readonly Note[] {
    return this.notes
  }
}
