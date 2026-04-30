import { Score, ScoreOptions } from '../model/Score.js'
import { parse } from '../parser/parser.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import type { Timeline } from '../scheduler/timeline.js'
import { Voice } from './Voice.js'
import type { Clef } from '../model/VoiceModel.js'
import { VexFlowAdapter } from '../adapters/renderer/VexFlowAdapter.js'
import type { RenderOptions as RendererRenderOptions } from '../adapters/renderer/types.js'
import type { ToneAdapter } from '../adapters/audio/ToneAdapter.js'
import { midiToPitch, pitchToMidi } from '../model/Pitch.js'
import { durationToDenom } from '../model/Duration.js'
import { nodeToNote } from '../model/converter.js'
import type { NoteNode } from '../parser/types.js'
import type { PitchName, Accidental, Octave } from '../model/types.js'

export interface SongOptions {
  tempo?: number
  timeSignature?: string
  key?: string
  instrument?: string
  title?: string
  composer?: string
}

export interface RenderOptions {
  width?: number
  theme?: 'light' | 'dark'
  showDynamics?: boolean
  grandStaff?: boolean
  showBarNumbers?: boolean
  showPartNames?: boolean
  partNameStyle?: 'full' | 'abbreviated'
}

export interface PlayOptions {
  voices?: string[]
  solo?: boolean
}

export interface SeekPosition {
  measure: number
  beat: number
}

type SongEventType = 'beat' | 'note' | 'measure' | 'end'
type SongEventHandler = (data: Record<string, unknown>) => void

export class Song {
  private readonly options: SongOptions
  private score: Score
  private voices: Map<string, Voice> = new Map()
  private defaultNotation: string[] = []
  private eventHandlers: Map<SongEventType, SongEventHandler[]> = new Map()
  private audioAdapter: ToneAdapter | null = null
  private tempoChanges: Array<{ measure: number; bpm: number }> = []
  private loopSettings: { startMeasure: number; endMeasure: number } | null = null

  constructor(options?: SongOptions) {
    this.options = {
      tempo: 120,
      timeSignature: '4/4',
      key: 'C',
      instrument: 'piano',
      ...options,
    }
    this.score = new Score(this.toScoreOptions())
  }

  /**
   * Add notation to the default voice.
   * Accepts the Maestro note syntax string.
   */
  add(notation: string): this {
    this.defaultNotation.push(notation)
    this.rebuildScore()
    return this
  }

  /**
   * Create or get a named voice for multi-voice writing.
   */
  voice(name: string, options?: { clef?: Clef }): Voice {
    let v = this.voices.get(name)
    if (!v) {
      v = new Voice(name, options?.clef ?? 'treble', this)
      this.voices.set(name, v)
    }
    return v
  }

  /**
   * Get the internal Score model (for renderer/scheduler consumption).
   */
  getScore(): Score {
    return this.score
  }

  /**
   * Build a playback timeline from the current score.
   */
  getTimeline(): Timeline {
    return Scheduler.buildTimeline(this.score)
  }

  /**
   * Register an event handler for playback events.
   */
  on(event: SongEventType, handler: SongEventHandler): this {
    const handlers = this.eventHandlers.get(event) ?? []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
    return this
  }

  /**
   * Remove an event handler.
   */
  off(event: SongEventType, handler: SongEventHandler): this {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
    return this
  }

  // --- Stubs for future phases ---

  /** Convert Song-level RenderOptions to internal renderer options, stripping undefined keys. */
  private toRendererOptions(options?: RenderOptions): RendererRenderOptions {
    if (!options) return {}
    const opts: RendererRenderOptions = {}
    if (options.width !== undefined) opts.width = options.width
    if (options.theme !== undefined) opts.theme = options.theme
    if (options.showDynamics !== undefined) opts.showDynamics = options.showDynamics
    if (options.grandStaff !== undefined) opts.grandStaff = options.grandStaff
    if (options.showBarNumbers !== undefined) opts.showBarNumbers = options.showBarNumbers
    if (options.showPartNames !== undefined) opts.showPartNames = options.showPartNames
    if (options.partNameStyle !== undefined) opts.partNameStyle = options.partNameStyle
    return opts
  }

  /** Render sheet music to a target element. */
  render(target: string | HTMLElement, options?: RenderOptions): this {
    const element =
      typeof target === 'string'
        ? typeof document !== 'undefined'
          ? document.querySelector(target)
          : null
        : target

    if (!element) {
      throw new Error(`Render target "${target}" not found.`)
    }

    VexFlowAdapter.render(this.score, element as HTMLElement, this.toRendererOptions(options))
    return this
  }

  /** Play the song. Returns a promise that resolves when playback starts. */
  async play(options?: PlayOptions): Promise<this> {
    const adapter = await this.getOrCreateAudioAdapter(options)

    // Forward events from adapter to Song handlers
    this.wireAdapterEvents(adapter)

    await adapter.play()
    return this
  }

  /** Pause playback. */
  pause(): this {
    if (this.audioAdapter) {
      this.audioAdapter.pause()
    }
    return this
  }

  /** Stop playback and reset position. */
  stop(): this {
    if (this.audioAdapter) {
      this.audioAdapter.stop()
    }
    return this
  }

  /** Seek to a position. */
  seekTo(position: SeekPosition): this {
    if (this.audioAdapter) {
      this.audioAdapter.seekTo(position.measure, position.beat)
    }
    return this
  }

  /** Export as SVG string. */
  exportSVG(options?: RenderOptions): string {
    const result = VexFlowAdapter.renderToSVG(this.score, this.toRendererOptions(options))
    return result.svg
  }

  /** Export as MIDI buffer. */
  async exportMIDI(): Promise<Uint8Array> {
    const { MIDIAdapter } = await import('../adapters/export/MIDIAdapter.js')
    return MIDIAdapter.export(this.score)
  }

  /** Export as portable JSON format (includes raw notation for round-tripping). */
  exportJSON(): object {
    return {
      version: 1,
      options: { ...this.options },
      defaultNotation: this.defaultNotation,
      voices: Array.from(this.voices.entries()).map(([name, v]) => ({
        name,
        clef: v.getClef(),
        notations: v.getNotations(),
      })),
      tempoChanges: this.tempoChanges,
    }
  }

  /** Load from a previously exported JSON object. */
  static fromJSON(json: object): Song {
    const data = json as {
      version?: number
      options?: SongOptions
      defaultNotation?: string[]
      voices?: Array<{ name: string; clef?: Clef; notations: string[] }>
      tempoChanges?: Array<{ measure: number; bpm: number }>
    }

    const song = new Song(data.options)

    if (data.defaultNotation) {
      for (const notation of data.defaultNotation) {
        song.add(notation)
      }
    }

    if (data.voices) {
      for (const v of data.voices) {
        const voice = song.voice(v.name, { clef: v.clef })
        for (const notation of v.notations) {
          voice.add(notation)
        }
      }
    }

    if (data.tempoChanges) {
      for (const tc of data.tempoChanges) {
        song.tempoAt(tc.measure, tc.bpm)
      }
    }

    return song
  }

  /** Export as ScoreJSON — a portable format for storage and exchange. */
  async exportScoreJSON(): Promise<import('../adapters/export/ScoreJSONAdapter.js').ScoreJSON> {
    const { ScoreJSONAdapter } = await import('../adapters/export/ScoreJSONAdapter.js')
    return ScoreJSONAdapter.toJSON(this.score)
  }

  /** Load from a ScoreJSON object. Returns a new Song backed by the imported Score. */
  static async fromScoreJSON(
    json: import('../adapters/export/ScoreJSONAdapter.js').ScoreJSON
  ): Promise<Song> {
    const { ScoreJSONAdapter } = await import('../adapters/export/ScoreJSONAdapter.js')
    const score = ScoreJSONAdapter.fromJSON(json)
    const song = new Song({
      tempo: score.tempo,
      timeSignature: `${score.timeSignature.beats}/${durationToDenom(score.timeSignature.noteValue)}`,
      key: score.key,
      title: score.title,
      composer: score.composer,
    })
    // Replace the internally built score with the imported one
    song.score = score
    return song
  }

  /** Export as PNG buffer (requires `sharp` package: npm install sharp). */
  async exportPNG(options?: RenderOptions): Promise<Uint8Array> {
    const svg = this.exportSVG(options)
    try {
      // Dynamic import so sharp is only required when exportPNG is actually called
      const sharpModule = await import('sharp')
      const sharp = sharpModule.default ?? sharpModule
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
      return new Uint8Array(pngBuffer)
    } catch {
      throw new Error(
        'exportPNG() requires the "sharp" package. Install it with: npm install sharp'
      )
    }
  }

  /** Transpose all notes by semitones (positive = up, negative = down). */
  transpose(semitones: number): this {
    // Transpose each notation string by shifting pitches
    this.defaultNotation = this.defaultNotation.map((n) => transposeNotation(n, semitones))

    for (const v of this.voices.values()) {
      const transposed = v.getNotations().map((n) => transposeNotation(n, semitones))
      v._replaceNotations(transposed)
    }

    this.rebuildScore()
    return this
  }

  /** Set a tempo change at a specific measure number. */
  tempoAt(measure: number, bpm: number): this {
    this.tempoChanges.push({ measure, bpm })
    this.score.tempoAt(measure, bpm)
    return this
  }

  /**
   * Set a loop range for playback. The specified measures will repeat
   * indefinitely until stop() is called or clearLoop() removes the loop.
   * @param startMeasure 1-based start measure (inclusive)
   * @param endMeasure 1-based end measure (inclusive)
   */
  loop(startMeasure: number, endMeasure: number): this {
    this.loopSettings = { startMeasure, endMeasure }
    this.score.setLoop(startMeasure, endMeasure)
    return this
  }

  /** Clear any active loop. */
  clearLoop(): this {
    this.loopSettings = null
    this.score.clearLoop()
    return this
  }

  // --- Internal ---

  /** @internal Called by Voice when notation is added. */
  _notifyVoiceChanged(): void {
    this.rebuildScore()
  }

  private async getOrCreateAudioAdapter(options?: PlayOptions): Promise<ToneAdapter> {
    // Dispose old adapter if options change
    if (this.audioAdapter) {
      this.audioAdapter.dispose()
    }
    const { ToneAdapter: Adapter } = await import('../adapters/audio/ToneAdapter.js')
    const adapter = new Adapter()
    adapter.load(this.score, {
      voices: options?.voices,
      solo: options?.solo,
      instrument: this.options.instrument,
    })
    this.audioAdapter = adapter
    return adapter
  }

  private wireAdapterEvents(adapter: ToneAdapter): void {
    const eventTypes: SongEventType[] = ['beat', 'note', 'measure', 'end']
    for (const eventType of eventTypes) {
      adapter.on(eventType, (data) => {
        const handlers = this.eventHandlers.get(eventType) ?? []
        for (const handler of handlers) {
          handler(data)
        }
      })
    }
  }

  private rebuildScore(): void {
    this.score = new Score(this.toScoreOptions())

    // Re-apply stored tempo changes
    for (const { measure, bpm } of this.tempoChanges) {
      this.score.tempoAt(measure, bpm)
    }

    // Re-apply stored loop
    if (this.loopSettings) {
      this.score.setLoop(this.loopSettings.startMeasure, this.loopSettings.endMeasure)
    }

    // Build default voice from add() calls
    if (this.defaultNotation.length > 0) {
      const combined = this.defaultNotation.join(' ')
      const nodes = parse(combined)
      const part = this.score.addPart('default')
      const voice = part.addVoice('default', 'treble')

      this.processNodes(nodes, voice)
    }

    // Build named voices
    for (const [name, v] of this.voices) {
      const notations = v.getNotations()
      if (notations.length === 0) continue

      const combined = notations.join(' ')
      const nodes = parse(combined)

      let part = this.score.getPart(name)
      if (!part) {
        part = this.score.addPart(name)
      }
      const voiceModel = part.addVoice(name, v.getClef())
      this.processNodes(nodes, voiceModel)
    }
  }

  private processNodes(
    nodes: NoteNode[],
    voice: import('../model/VoiceModel.js').VoiceModel
  ): void {
    let measureCount = 1
    let repeatStartMeasure = -1

    for (const node of nodes) {
      if (node.isBarline) {
        if (node.repeatStart) {
          repeatStartMeasure = measureCount + 1
        }
        if (node.repeatEnd) {
          const start = repeatStartMeasure > 0 ? repeatStartMeasure : 1
          this.score.addRepeatSection(start, measureCount)
          repeatStartMeasure = -1
        }
        if (node.daCapo) {
          this.score.setDaCapo(true)
        }
        measureCount++
        continue
      }
      const note = nodeToNote(node)
      voice.addNote(note, this.score.timeSignature)
    }
  }

  private toScoreOptions(): Partial<ScoreOptions> {
    return {
      tempo: this.options.tempo,
      timeSignature: this.options.timeSignature,
      key: this.options.key,
      title: this.options.title,
      composer: this.options.composer,
    }
  }
}

// Regex to match a single pitch token within a notation string (e.g. C#4, Bb3, G5)
const PITCH_IN_NOTATION = /([A-G])(##|bb|#|b)?([0-8])/g

/**
 * Transpose all pitches in a notation string by a number of semitones.
 */
function transposeNotation(notation: string, semitones: number): string {
  return notation.replace(PITCH_IN_NOTATION, (_match, pitchStr, accStr, octStr) => {
    const pitch = pitchStr as PitchName
    const accidental = (accStr ?? null) as Accidental
    const octave = parseInt(octStr, 10) as Octave
    const midi = pitchToMidi(pitch, accidental, octave)
    const newMidi = Math.max(0, Math.min(127, midi + semitones))
    const result = midiToPitch(newMidi)
    const accOut = result.accidental ?? ''
    return `${result.pitch}${accOut}${result.octave}`
  })
}
