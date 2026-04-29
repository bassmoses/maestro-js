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

export class Score {
  readonly tempo: number
  readonly timeSignature: TimeSignature
  readonly key: string
  readonly title: string
  readonly composer: string
  private parts: Map<string, Part>

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
}
