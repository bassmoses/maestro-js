import type { Clef } from '../model/VoiceModel.js'
import type { Song } from './Song.js'

/**
 * Chainable voice builder for multi-voice notation.
 * Created via `song.voice('soprano', { clef: 'treble' })`.
 */
export class Voice {
  private readonly name: string
  private readonly clef: Clef
  private readonly song: Song
  private notations: string[] = []

  constructor(name: string, clef: Clef, song: Song) {
    this.name = name
    this.clef = clef
    this.song = song
  }

  /**
   * Add notation to this voice.
   * Returns `this` for chaining.
   */
  add(notation: string): this {
    this.notations.push(notation)
    this.song._notifyVoiceChanged()
    return this
  }

  /** Get the clef for this voice. */
  getClef(): Clef {
    return this.clef
  }

  /** Get all notation strings added to this voice. */
  getNotations(): string[] {
    return this.notations
  }

  /** Get the voice name. */
  getName(): string {
    return this.name
  }

  /** @internal Replace all notations (used by transpose). */
  _replaceNotations(notations: string[]): void {
    this.notations = notations
  }
}
