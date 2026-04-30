import { DurationName } from './types.js'
import { Part } from './Part.js'
import { TimeSignature } from './Measure.js'

export interface ScoreOptions {
  tempo: number // BPM, default 120
  timeSignature: string // '4/4', '3/4' etc, default '4/4'
  key: string // 'C', 'D', 'Bb' etc, default 'C'
  title?: string
  composer?: string
}

export type { TimeSignature as TimeSignatureParsed }

const NOTE_VALUE_MAP: Record<string, DurationName> = {
  '1': 'w',
  '2': 'h',
  '4': 'q',
  '8': 'e',
  '16': 's',
  '32': 't',
}

export interface RepeatSection {
  startMeasure: number // 1-based
  endMeasure: number // 1-based, inclusive
}

export interface LoopRange {
  startMeasure: number // 1-based
  endMeasure: number // 1-based, inclusive
}

export class Score {
  readonly tempo: number
  readonly timeSignature: TimeSignature
  readonly key: string
  readonly title: string
  readonly composer: string
  private parts: Map<string, Part>
  private tempoMap: Map<number, number> = new Map() // measure number → BPM
  private repeatSections: RepeatSection[] = []
  private hasDaCapo: boolean = false
  private loopRange: LoopRange | null = null

  constructor(options?: Partial<ScoreOptions>) {
    this.tempo = options?.tempo ?? 120
    this.timeSignature = Score.parseTimeSignature(options?.timeSignature ?? '4/4')
    this.key = options?.key ?? 'C'
    this.title = options?.title ?? ''
    this.composer = options?.composer ?? ''
    this.parts = new Map()
  }

  static parseTimeSignature(str: string): TimeSignature {
    const parts = str.split('/')
    if (parts.length !== 2) {
      throw new Error(`Invalid time signature: "${str}"`)
    }

    const beats = parseInt(parts[0], 10)
    const denominator = parts[1]

    if (isNaN(beats) || beats <= 0) {
      throw new Error(`Invalid time signature numerator in: "${str}"`)
    }

    const noteValue = NOTE_VALUE_MAP[denominator]
    if (!noteValue) {
      throw new Error(`Invalid time signature denominator "${denominator}" in: "${str}"`)
    }

    return { beats, noteValue }
  }

  addPart(name: string): Part {
    if (this.parts.has(name)) {
      throw new Error(`Part "${name}" already exists. Use getPart() to retrieve it.`)
    }
    const part = new Part(name)
    this.parts.set(name, part)
    return part
  }

  getPart(name: string): Part | undefined {
    return this.parts.get(name)
  }

  getParts(): readonly Part[] {
    return Array.from(this.parts.values())
  }

  /**
   * Set a tempo change at a specific measure.
   * The tempo applies from that measure onwards until the next change.
   */
  tempoAt(measure: number, bpm: number): this {
    this.tempoMap.set(measure, bpm)
    return this
  }

  /**
   * Get the full tempo map (measure → BPM).
   * The Scheduler uses this for variable-tempo timelines.
   */
  getTempoMap(): ReadonlyMap<number, number> {
    return this.tempoMap
  }

  /**
   * Get the effective tempo at a specific measure number.
   * Walks backwards through the tempo map to find the most recent change.
   */
  getTempoAtMeasure(measure: number): number {
    let effectiveTempo = this.tempo
    for (let m = 1; m <= measure; m++) {
      if (this.tempoMap.has(m)) {
        effectiveTempo = this.tempoMap.get(m)!
      }
    }
    return effectiveTempo
  }

  /**
   * Add a repeat section (measures between |: and :|).
   */
  addRepeatSection(startMeasure: number, endMeasure: number): this {
    this.repeatSections.push({ startMeasure, endMeasure })
    return this
  }

  /**
   * Get all repeat sections.
   */
  getRepeatSections(): readonly RepeatSection[] {
    return this.repeatSections
  }

  /**
   * Mark this score as having a Da Capo (play from beginning after end).
   */
  setDaCapo(value: boolean): this {
    this.hasDaCapo = value
    return this
  }

  /**
   * Whether this score has a Da Capo marking.
   */
  getDaCapo(): boolean {
    return this.hasDaCapo
  }

  /**
   * Set a loop range (measures to repeat indefinitely during playback).
   * Pass null to clear the loop.
   */
  setLoop(startMeasure: number, endMeasure: number): this {
    if (startMeasure < 1 || endMeasure < 1) {
      throw new Error(`Loop measures must be >= 1. Got start=${startMeasure}, end=${endMeasure}`)
    }
    if (endMeasure < startMeasure) {
      throw new Error(`Loop endMeasure (${endMeasure}) must be >= startMeasure (${startMeasure})`)
    }
    this.loopRange = { startMeasure, endMeasure }
    return this
  }

  /**
   * Clear any active loop.
   */
  clearLoop(): this {
    this.loopRange = null
    return this
  }

  /**
   * Get the current loop range, or null if no loop is set.
   */
  getLoop(): LoopRange | null {
    return this.loopRange
  }
}
