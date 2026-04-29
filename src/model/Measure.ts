import { DurationName } from './types.js'
import { DURATION_BEATS } from './Duration.js'
import { Note } from './Note.js'

export interface TimeSignature {
  beats: number
  noteValue: DurationName
}

export class Measure {
  readonly timeSignature: TimeSignature
  private notes: Note[]

  constructor(timeSignature: TimeSignature) {
    this.timeSignature = timeSignature
    this.notes = []
  }

  /**
   * The total beat capacity of this measure based on the time signature.
   * e.g. 4/4 => 4 beats (based on quarter note = 1 beat reference).
   */
  private get capacityBeats(): number {
    // beats in numerator * value of note denominator relative to quarter
    // noteValue beats gives the beat value of one denominator note
    const noteBeats = DURATION_BEATS[this.timeSignature.noteValue]
    return this.timeSignature.beats * noteBeats
  }

  get totalBeats(): number {
    return this.notes.reduce((sum, note) => sum + note.beats, 0)
  }

  get beatsRemaining(): number {
    return this.capacityBeats - this.totalBeats
  }

  get isFull(): boolean {
    return this.beatsRemaining <= 1e-9
  }

  addNote(note: Note): void {
    if (note.beats > this.beatsRemaining + 1e-9) {
      throw new Error(
        `Note (${note.beats} beats) would overflow measure ` +
          `(${this.beatsRemaining} beats remaining)`
      )
    }
    this.notes.push(note)
  }

  getNotes(): readonly Note[] {
    return this.notes
  }
}
