import { Score, ScoreOptions } from '../model/Score.js'
import { parse } from '../parser/parser.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import type { Timeline } from '../scheduler/timeline.js'
import { Voice } from './Voice.js'
import { TimingCallbacks } from '../scheduler/TimingCallbacks.js'
import type { TimingCallbackOptions } from '../scheduler/timeline.js'
import type { Clef } from '../model/VoiceModel.js'
import { VexFlowAdapter } from '../adapters/renderer/VexFlowAdapter.js'
import type {
  RenderOptions as RendererRenderOptions,
  NotePositionMap,
} from '../adapters/renderer/types.js'
import { ChordGridRenderer } from '../adapters/renderer/ChordGridRenderer.js'
import type { ChordGridOptions } from '../adapters/renderer/ChordGridRenderer.js'
import type { ToneAdapter } from '../adapters/audio/ToneAdapter.js'
import { midiToPitch, pitchToMidi } from '../model/Pitch.js'
import { durationToDenom } from '../model/Duration.js'
import { nodeToNote } from '../model/converter.js'
import type { NoteNode } from '../parser/types.js'
import type { PitchName, Accidental, Octave } from '../model/types.js'
import { Cursor } from '../ui/Cursor.js'
import type { CursorOptions } from '../ui/Cursor.js'

export interface SongOptions {
  tempo?: number
  timeSignature?: string
  key?: string
  instrument?: string
  title?: string
  composer?: string
}

export interface InstrumentOptions {
  soundfont?: 'MusyngKite' | 'FluidR3_GM'
  soundfontUrl?: string
}

export interface RenderOptions {
  width?: number
  theme?: 'light' | 'dark'
  showDynamics?: boolean
  grandStaff?: boolean
  showBarNumbers?: boolean
  showPartNames?: boolean
  partNameStyle?: 'full' | 'abbreviated'
  zoom?: number
  ariaLabel?: boolean
}

export interface NoteClickInfo {
  measureIndex: number
  voiceIndex: number
  noteIndex: number
  note: import('../model/Note.js').Note
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

export interface SongJSON {
  version: number
  options: SongOptions
  defaultNotation: string[]
  voices: Array<{ name: string; clef: Clef; notations: string[] }>
  tempoChanges: Array<{ measure: number; bpm: number }>
}

export class Song {
  private readonly options: SongOptions
  private score: Score
  private voices: Map<string, Voice> = new Map()
  private defaultNotation: string[] = []
  private eventHandlers: Map<SongEventType, SongEventHandler[]> = new Map()
  private audioAdapter: ToneAdapter | null = null
  private adapterPromise: Promise<ToneAdapter> | null = null
  private tempoChanges: Array<{ measure: number; bpm: number }> = []
  private loopSettings: { startMeasure: number; endMeasure: number } | null = null
  private pendingEffects: { reverb?: number; delay?: number; chorus?: number } | null = null
  private pickupEnabled: boolean = false
  private cursor: Cursor | null = null
  private notePositionMap: NotePositionMap = new Map()
  private renderedSvgContainer: SVGSVGElement | null = null
  private clickHandlers: Array<(info: NoteClickInfo) => void> = []
  private selectedNote: NoteClickInfo | null = null
  private clickListenerCleanup: (() => void) | null = null
  private soundfontOptions: InstrumentOptions | null = null
  private useSoundfont = false
  private zoomFactor: number = 1.0
  private resizeObserver: ResizeObserver | null = null
  private renderTarget: HTMLElement | null = null
  private lastRenderOptions: RenderOptions | undefined = undefined

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

  /**
   * Create a TimingCallbacks instance backed by the current score's timeline.
   * If the audio adapter is already loaded, also wires callbacks into ToneAdapter
   * so Tone.Draw fires them at the correct audio-clock time during play().
   */
  createTimingCallbacks(options: TimingCallbackOptions): TimingCallbacks {
    const mergedTimeline = Scheduler.mergeTies(Scheduler.buildTimeline(this.score))
    const tc = new TimingCallbacks(mergedTimeline, options)

    // If audio adapter is already loaded, also wire callbacks into ToneAdapter
    if (this.audioAdapter) {
      this.audioAdapter.setTimingCallbacks(options)
    }

    return tc
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
    if (options.zoom !== undefined) opts.zoom = options.zoom
    if (options.ariaLabel !== undefined) opts.ariaLabel = options.ariaLabel
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

    this.renderTarget = element as HTMLElement
    this.lastRenderOptions = options

    this.notePositionMap = VexFlowAdapter.render(
      this.score,
      element as HTMLElement,
      this.toRendererOptions({ ...options, zoom: this.zoomFactor })
    )

    if (typeof document !== 'undefined') {
      const svgs = (element as HTMLElement).querySelectorAll('svg')
      this.renderedSvgContainer = svgs.length > 0 ? (svgs[svgs.length - 1] as SVGSVGElement) : null
      this.setupClickDelegation(element as HTMLElement)
    }

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

  /**
   * Set the instrument for playback. When soundfont options are provided,
   * playback will use SoundfontAdapter; otherwise the default ToneAdapter is used.
   */
  useInstrument(name: string, options?: InstrumentOptions): this {
    if (this.options) {
      this.options.instrument = name
    }
    if (options !== undefined) {
      this.soundfontOptions = options
      this.useSoundfont = !!(options.soundfont || options.soundfontUrl)
    } else {
      this.soundfontOptions = null
      this.useSoundfont = false
    }
    // Dispose current adapter so next play() creates a fresh one
    if (this.audioAdapter) {
      this.audioAdapter.dispose()
      this.audioAdapter = null
    }
    return this
  }

  /** Apply audio effects (reverb, delay, chorus). Call before or after play(). */
  async effects(fx: { reverb?: number; delay?: number; chorus?: number }): Promise<this> {
    this.pendingEffects = fx
    // Apply immediately if adapter already exists
    if (this.audioAdapter) {
      this.audioAdapter.applyEffects(fx)
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

  /**
   * Render a chord grid (jazz lead-sheet style) into a target element.
   * Each cell = one measure showing the chord symbol and rhythm slashes.
   * Chord symbols are sourced from @"Chord" annotations in the notation.
   *
   * @param target CSS selector string or HTMLElement
   * @param options Optional grid layout options
   */
  renderChordGrid(target: string | HTMLElement, options?: ChordGridOptions): this {
    const element =
      typeof target === 'string'
        ? typeof document !== 'undefined'
          ? document.querySelector(target)
          : null
        : target

    if (!element) {
      throw new Error(`renderChordGrid target "${String(target)}" not found.`)
    }

    const svgString = ChordGridRenderer.render(this.score, options)
    const el = element as HTMLElement
    // Clear existing content
    while (el.firstChild) {
      el.removeChild(el.firstChild)
    }
    // Parse the SVG string and append via DOM API (avoids raw innerHTML assignment)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgString, 'image/svg+xml')
      const svgEl = doc.documentElement
      el.appendChild(el.ownerDocument.adoptNode(svgEl))
    } else {
      // Node.js / non-browser environment fallback (tests with jsdom use DOMParser path)
      el.setAttribute('data-chord-grid', svgString)
    }
    return this
  }

  /** Export as MIDI buffer. */
  async exportMIDI(): Promise<Uint8Array> {
    const { MIDIAdapter } = await import('../adapters/export/MIDIAdapter.js')
    return MIDIAdapter.export(this.score)
  }

  /** Export as portable JSON format (includes raw notation for round-tripping). */
  exportJSON(): SongJSON {
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
    if (!json || typeof json !== 'object') {
      throw new Error('Song.fromJSON() requires a non-null object.')
    }
    const data = json as Record<string, unknown>

    const song = new Song(data.options as SongOptions | undefined)

    if (data.defaultNotation != null) {
      if (!Array.isArray(data.defaultNotation)) {
        throw new Error('Song.fromJSON(): defaultNotation must be an array of strings.')
      }
      for (const notation of data.defaultNotation) {
        if (typeof notation !== 'string') {
          throw new Error('Song.fromJSON(): defaultNotation must contain only strings.')
        }
        song.add(notation)
      }
    }

    if (data.voices != null) {
      if (!Array.isArray(data.voices)) {
        throw new Error('Song.fromJSON(): voices must be an array.')
      }
      for (const v of data.voices as Array<Record<string, unknown>>) {
        if (typeof v.name !== 'string') {
          throw new Error('Song.fromJSON(): each voice must have a string "name".')
        }
        if (!Array.isArray(v.notations)) {
          throw new Error(`Song.fromJSON(): voice "${v.name}" must have a "notations" array.`)
        }
        const voice = song.voice(v.name, { clef: v.clef as Clef | undefined })
        for (const notation of v.notations) {
          if (typeof notation !== 'string') {
            throw new Error(
              `Song.fromJSON(): voice "${v.name}" notations must contain only strings.`
            )
          }
          voice.add(notation)
        }
      }
    }

    if (data.tempoChanges != null) {
      if (!Array.isArray(data.tempoChanges)) {
        throw new Error('Song.fromJSON(): tempoChanges must be an array.')
      }
      for (const tc of data.tempoChanges as Array<Record<string, unknown>>) {
        if (typeof tc.measure !== 'number' || typeof tc.bpm !== 'number') {
          throw new Error(
            'Song.fromJSON(): each tempoChange must have numeric "measure" and "bpm".'
          )
        }
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

  /** Import a MusicXML string and return a new Song backed by the parsed Score. */
  static async fromMusicXML(xmlString: string): Promise<Song> {
    const { MusicXMLAdapter } = await import('../adapters/import/MusicXMLAdapter.js')
    const score = MusicXMLAdapter.fromXML(xmlString)
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

  /**
   * Mark this song as having a pickup (anacrusis) measure.
   * Affects notation rendering (measure numbering) and VexFlow output.
   */
  setPickup(enabled: boolean): this {
    this.pickupEnabled = enabled
    this.score.setPickup(enabled)
    return this
  }

  /** Enable a playback cursor overlay on the rendered SVG. */
  enableCursor(options?: CursorOptions): this {
    if (typeof document === 'undefined') return this
    this.cursor?.detach()
    this.cursor = new Cursor(options)
    if (this.renderedSvgContainer) {
      this.cursor.attach(this.renderedSvgContainer)
    }
    return this
  }

  /** Detach and remove the playback cursor. */
  disableCursor(): this {
    this.cursor?.detach()
    this.cursor = null
    return this
  }

  /** Set the zoom scale factor for rendering. Re-renders immediately if already rendered. */
  setZoom(factor: number): this {
    this.zoomFactor = factor
    if (this.renderTarget) {
      this.rerender()
    }
    return this
  }

  /** Enable or disable responsive re-rendering via ResizeObserver. */
  setResponsive(enabled: boolean): this {
    if (typeof ResizeObserver === 'undefined') return this

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    if (enabled && this.renderTarget) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = Math.round(entry.contentRect.width)
          if (newWidth > 0) {
            this.rerender()
          }
        }
      })
      this.resizeObserver.observe(this.renderTarget)
    }

    return this
  }

  /** Register a click handler. Called when the user clicks a note in the rendered SVG. */
  onClick(handler: (info: NoteClickInfo) => void): this {
    this.clickHandlers.push(handler)
    return this
  }

  /** Returns the currently selected note info, or null if nothing is selected. */
  getSelectedNote(): NoteClickInfo | null {
    return this.selectedNote
  }

  /** Deselect the currently selected note. */
  clearSelection(): this {
    if (this.selectedNote) {
      const pos = this.notePositionMap.get(this.selectedNote.noteIndex)
      pos?.svgElement?.classList.remove('maestro-note-selected')
      this.selectedNote = null
    }
    return this
  }

  // --- Internal ---

  /** @internal Called by Voice when notation is added. */
  _notifyVoiceChanged(): void {
    this.rebuildScore()
  }

  private async getOrCreateAudioAdapter(options?: PlayOptions): Promise<ToneAdapter> {
    // Prevent concurrent adapter creation
    if (this.adapterPromise) {
      await this.adapterPromise
    }
    const promise = this.createAudioAdapter(options)
    this.adapterPromise = promise
    try {
      const adapter = await promise
      return adapter
    } finally {
      this.adapterPromise = null
    }
  }

  private async createAudioAdapter(options?: PlayOptions): Promise<ToneAdapter> {
    // Dispose old adapter if options change
    if (this.audioAdapter) {
      this.audioAdapter.dispose()
      this.audioAdapter = null
    }

    if (this.useSoundfont) {
      const { SoundfontAdapter } = await import('../adapters/audio/SoundfontAdapter.js')
      const adapter = new SoundfontAdapter()
      adapter.load(this.score, {
        instrument: this.options.instrument,
        soundfont: this.soundfontOptions?.soundfont,
        soundfontUrl: this.soundfontOptions?.soundfontUrl,
      })
      this.audioAdapter = adapter as unknown as ToneAdapter // same runtime interface
      return adapter as unknown as ToneAdapter
    }

    const { ToneAdapter: Adapter } = await import('../adapters/audio/ToneAdapter.js')
    const adapter = new Adapter()
    adapter.load(this.score, {
      voices: options?.voices,
      solo: options?.solo,
      instrument: this.options.instrument,
    })
    // Re-apply stored effects
    if (this.pendingEffects) {
      adapter.applyEffects(this.pendingEffects)
    }
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

  private setupClickDelegation(container: HTMLElement): void {
    this.clickListenerCleanup?.()
    const listener = (e: Event) => {
      let el: Element | null = e.target as Element | null
      while (el && el !== container) {
        const noteIndexAttr = el.getAttribute('data-note-index')
        const measureIndexAttr = el.getAttribute('data-measure-index')
        if (noteIndexAttr !== null && measureIndexAttr !== null) {
          const noteIdx = parseInt(noteIndexAttr, 10)
          const measureIdx = parseInt(measureIndexAttr, 10)
          if (isNaN(noteIdx) || isNaN(measureIdx)) return
          this.handleNoteClick(noteIdx, measureIdx, el)
          return
        }
        el = el.parentElement
      }
    }
    container.addEventListener('click', listener)
    this.clickListenerCleanup = () => container.removeEventListener('click', listener)
  }

  private handleNoteClick(noteIndex: number, measureIndex: number, svgEl: Element): void {
    // Deselect previous
    if (this.selectedNote) {
      const prevEl = this.notePositionMap.get(this.selectedNote.noteIndex)?.svgElement
      prevEl?.classList.remove('maestro-note-selected')
    }

    // Resolve note from score model using measureIndex
    // The score may have multiple parts/voices; find the note by scanning all voices
    const parts = this.score.getParts()
    let resolvedNote: import('../model/Note.js').Note | null = null
    let resolvedVoiceIndex = 0

    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi]
      const voices = part.getVoices()
      for (let vi = 0; vi < voices.length; vi++) {
        const voice = voices[vi]
        const measures = voice.getMeasures()
        if (measureIndex >= measures.length) continue
        const measure = measures[measureIndex]
        if (!measure) continue

        // Compute flat note offset for this measure across this voice
        let offset = 0
        for (let mi = 0; mi < measureIndex; mi++) {
          offset += measures[mi]?.getNotes().length ?? 0
        }
        const localNoteIndex = noteIndex - offset
        const notes = measure.getNotes()
        if (localNoteIndex >= 0 && localNoteIndex < notes.length) {
          resolvedNote = notes[localNoteIndex] ?? null
          resolvedVoiceIndex = pi
          break
        }
      }
      if (resolvedNote) break
    }

    if (!resolvedNote) return

    const info: NoteClickInfo = {
      measureIndex,
      voiceIndex: resolvedVoiceIndex,
      noteIndex,
      note: resolvedNote,
    }

    this.selectedNote = info
    svgEl.classList.add('maestro-note-selected')

    for (const handler of this.clickHandlers) {
      try {
        handler(info)
      } catch (err) {
        console.error('[maestro] onClick handler threw:', err)
      }
    }
  }

  private rerender(): void {
    if (!this.renderTarget) return
    while (this.renderTarget.firstChild) {
      this.renderTarget.removeChild(this.renderTarget.firstChild)
    }
    this.notePositionMap = VexFlowAdapter.render(
      this.score,
      this.renderTarget,
      this.toRendererOptions({ ...(this.lastRenderOptions ?? {}), zoom: this.zoomFactor })
    )
    if (this.cursor && this.renderTarget) {
      const svgs = this.renderTarget.querySelectorAll('svg')
      this.renderedSvgContainer = svgs.length > 0 ? (svgs[svgs.length - 1] as SVGSVGElement) : null
      if (this.renderedSvgContainer) {
        this.cursor.attach(this.renderedSvgContainer)
      }
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

    // Re-apply pickup flag
    if (this.pickupEnabled) {
      this.score.setPickup(true)
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
    let firstNote = this.score.hasPickup

    for (const node of nodes) {
      if (node.isBarline) {
        // Seal a pending pickup measure when we see the first barline
        if (measureCount === 1 && this.score.hasPickup) {
          voice.closePickupMeasure()
        }
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
        if (node.dalSegno) {
          this.score.setDalSegno(true)
        }
        if (node.segno) {
          this.score.setSegnoMeasure(measureCount + 1)
        }
        if (node.coda) {
          this.score.setCodaMeasure(measureCount + 1)
        }
        if (node.fine) {
          this.score.setFineMeasure(measureCount)
        }
        if (node.volta != null) {
          this.score.addVoltaEnding(measureCount + 1, node.volta)
        }
        if (node.rehearsalMark) {
          voice.setPendingRehearsalMark(node.rehearsalMark)
        }
        measureCount++
        continue
      }
      const note = nodeToNote(node)
      voice.addNote(note, this.score.timeSignature, firstNote)
      firstNote = false
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
