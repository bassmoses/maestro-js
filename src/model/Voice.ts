import { DurationName } from './types.js'
import { Note } from './Note.js'
import { Measure, TimeSignature } from './Measure.js'

export type Clef = 'treble' | 'bass' | 'treble-8' | 'alto' | 'tenor'

export class VoiceModel {
  readonly name: string
  readonly clef: Clef
  private measures: Measure[]

  constructor(name: string, clef: Clef) {
    this.name = name
    this.clef = clef
    this.measures = []
  }

  /**
   * Add a note, auto-creating measures as needed.
   */
  addNote(note: Note, timeSignature: TimeSignature): void {
    // Get or create a measure with room for this note
    let current = this.measures[this.measures.length - 1]

    if (!current || current.isFull) {
      current = new Measure(timeSignature)
      this.measures.push(current)
    }

    current.addNote(note)
  }

  getMeasures(): readonly Measure[] {
    return this.measures
  }

  getAllNotes(): readonly Note[] {
    return this.measures.flatMap((m) => [...m.getNotes()])
  }
}
