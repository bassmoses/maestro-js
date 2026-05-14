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
  private _isPickup: boolean
  private _pickupSealed: boolean = false
  private notes: Note[]
  private _usedBeats: number = 0

  constructor(
    timeSignature: TimeSignature,
    rehearsalMark: string | null = null,
    isPickup: boolean = false
  ) {
    this.timeSignature = timeSignature
    this.rehearsalMark = rehearsalMark
    this._isPickup = isPickup
    this.notes = []
  }

  private get capacityBeats(): number {
    const noteBeats = DURATION_BEATS[this.timeSignature.noteValue]
    return this.timeSignature.beats * noteBeats
  }

  /**
   * True when this is an intentionally incomplete pickup bar.
   * A measure initialized as a pickup that is later filled to capacity
   * is treated as a regular measure (it was not actually a pickup).
   */
  get isPickup(): boolean {
    if (!this._isPickup) return false
    // If it filled naturally (not sealed early), it's not really a pickup
    if (!this._pickupSealed && this._usedBeats >= this.capacityBeats - BEAT_EPSILON) return false
    return true
  }

  get totalBeats(): number {
    return this._usedBeats
  }

  get beatsRemaining(): number {
    return this.capacityBeats - this._usedBeats
  }

  get isFull(): boolean {
    if (this._pickupSealed) return true
    if (this._isPickup) return false
    return this.beatsRemaining <= BEAT_EPSILON
  }

  /** Called by VoiceModel.closePickupMeasure() to finalize the pickup bar. */
  sealPickup(): void {
    this._pickupSealed = true
  }

  addNote(note: Note, advanceTime: boolean = true): void {
    if (advanceTime && !this._isPickup && note.beats > this.beatsRemaining + BEAT_EPSILON) {
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
