import type { Score } from '../../model/Score.js'
import { Scheduler } from '../../scheduler/Scheduler.js'
import type { Timeline } from '../../scheduler/timeline.js'
import type { PlaybackEventType, PlaybackEventHandler, AudioEffects } from './ToneAdapter.js'

export interface SoundfontOptions {
  instrument?: string
  soundfont?: 'MusyngKite' | 'FluidR3_GM'
  soundfontUrl?: string
}

const DEFAULT_SOUNDFONT_URL = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages'

const MIDI_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const GM_INSTRUMENT_MAP: Record<string, string> = {
  piano: 'acoustic_grand_piano',
  strings: 'string_ensemble_1',
  choir: 'choir_aahs',
  organ: 'church_organ',
  violin: 'violin',
  guitar: 'acoustic_guitar_nylon',
  flute: 'flute',
  trumpet: 'trumpet',
  synth: 'synth_lead_1_square',
}

/**
 * Audio playback adapter using Web Audio API with soundfont samples from a CDN.
 * Loads instrument samples (mp3) and schedules them via AudioBufferSourceNode.
 */
export class SoundfontAdapter {
  private audioContext: AudioContext | null = null
  private buffers: Map<number, AudioBuffer> = new Map()
  private activeSources: AudioBufferSourceNode[] = []
  private score: Score | null = null
  private timeline: Timeline = []
  private eventHandlers: Map<PlaybackEventType, PlaybackEventHandler[]> = new Map()
  private _isPlaying = false
  private _isPaused = false
  private pauseTime = 0
  private startTime = 0
  private instrumentName = 'acoustic_grand_piano'
  private soundfontName: 'MusyngKite' | 'FluidR3_GM' = 'MusyngKite'
  private soundfontBaseUrl = DEFAULT_SOUNDFONT_URL
  private scheduledTimeouts: ReturnType<typeof setTimeout>[] = []

  /**
   * Convert a MIDI note number to a note name string like 'C4', 'A4', 'Db3'.
   */
  static midiToNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1
    const noteIndex = midi % 12
    return `${MIDI_NOTE_NAMES[noteIndex]}${octave}`
  }

  /**
   * Build the CDN URL for a soundfont file.
   */
  static getSoundfontUrl(
    instrument: string,
    soundfont: 'MusyngKite' | 'FluidR3_GM' = 'MusyngKite',
    baseUrl: string = DEFAULT_SOUNDFONT_URL
  ): string {
    return `${baseUrl}/${soundfont}/${instrument}-mp3.js`
  }

  /**
   * Load a Score for playback. Builds the timeline; samples are fetched lazily on play().
   */
  load(score: Score, options?: SoundfontOptions): void {
    this.dispose()
    this.score = score
    this.instrumentName =
      GM_INSTRUMENT_MAP[options?.instrument ?? 'piano'] ??
      options?.instrument ??
      'acoustic_grand_piano'
    this.soundfontName = options?.soundfont ?? 'MusyngKite'
    this.soundfontBaseUrl = options?.soundfontUrl ?? DEFAULT_SOUNDFONT_URL
    this.timeline = Scheduler.mergeTies(Scheduler.buildTimeline(score))
  }

  /**
   * Start or resume playback. Fetches samples if not yet loaded.
   */
  async play(): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      throw new Error('SoundfontAdapter requires a browser AudioContext.')
    }
    if (this._isPlaying && !this._isPaused) return
    if (!this.score) throw new Error('No score loaded. Call load() before play().')

    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    if (this.buffers.size === 0) {
      await this.loadSamples()
    }

    if (this._isPaused) {
      this.scheduleTimeline(this.pauseTime)
      this._isPaused = false
      this._isPlaying = true
      return
    }

    this.scheduleTimeline(0)
    this._isPlaying = true
    this._isPaused = false
  }

  /**
   * Pause playback (resumable via play()).
   */
  pause(): void {
    if (!this._isPlaying) return
    this.pauseTime = this.audioContext ? this.audioContext.currentTime - this.startTime : 0
    this.clearScheduled()
    for (const src of this.activeSources) {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
    }
    this.activeSources = []
    this._isPaused = true
    this._isPlaying = false
  }

  /**
   * Stop playback and reset position to the beginning.
   */
  stop(): void {
    this.clearScheduled()
    for (const src of this.activeSources) {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
    }
    this.activeSources = []
    this.pauseTime = 0
    this._isPlaying = false
    this._isPaused = false
  }

  /**
   * Register an event handler for a playback event type.
   */
  on(event: PlaybackEventType, handler: PlaybackEventHandler): void {
    const handlers = this.eventHandlers.get(event) ?? []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  /**
   * Remove a previously registered event handler.
   */
  off(event: PlaybackEventType, handler: PlaybackEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
  }

  /**
   * Clean up all resources: stop playback, clear buffers, close AudioContext.
   */
  dispose(): void {
    this.stop()
    this.buffers.clear()
    this.timeline = []
    this.score = null
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
  }

  /**
   * No-op stub — SoundfontAdapter does not support DSP effects.
   */

  applyEffects(_effects: AudioEffects): void {
    // no-op
  }

  /**
   * Seek to a position in seconds. Stores the offset so resume works correctly.
   */
  seekTo(seconds: number): void {
    this.pauseTime = seconds
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get isPaused(): boolean {
    return this._isPaused
  }

  // ─── Private ─────────────────────────────────────────────────

  /**
   * Fetch and decode audio samples for all MIDI notes in the timeline.
   * Loads in parallel chunks of 16 to avoid saturating the network.
   */
  private async loadSamples(): Promise<void> {
    if (!this.audioContext) return

    const midiNotes = new Set<number>()
    for (const ev of this.timeline) {
      const midi = ev.note.midi
      if (midi != null) midiNotes.add(midi)
    }

    const baseUrl = `${this.soundfontBaseUrl}/${this.soundfontName}/${this.instrumentName}-mp3`
    const notes = [...midiNotes]
    const chunkSize = 16

    for (let i = 0; i < notes.length; i += chunkSize) {
      const chunk = notes.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (midi) => {
          const noteName = SoundfontAdapter.midiToNoteName(midi)
          const url = `${baseUrl}/${noteName}.mp3`
          try {
            const response = await fetch(url)
            if (!response.ok) return
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
            this.buffers.set(midi, audioBuffer)
          } catch {
            /* sample unavailable — note plays silently */
          }
        })
      )
    }
  }

  /**
   * Schedule all timeline events starting from offsetSeconds into the piece.
   */
  private scheduleTimeline(offsetSeconds: number): void {
    if (!this.audioContext) return
    this.clearScheduled()
    this.startTime = this.audioContext.currentTime - offsetSeconds

    for (const ev of this.timeline) {
      const time = ev.time
      const midi = ev.note.midi
      const duration = ev.note.duration
      const velocity = ev.note.velocity

      if (time < offsetSeconds) continue
      const delayMs = (this.startTime + time - this.audioContext.currentTime) * 1000

      const id = setTimeout(
        () => {
          this.playSample(midi, duration, velocity)
          this.emitEvent('note', {
            pitch: ev.note.pitch,
            midi,
            duration,
            time,
            velocity,
            measure: ev.note.measure,
            beat: ev.note.beat,
            voice: ev.note.voice,
          })
        },
        Math.max(0, delayMs)
      )
      this.scheduledTimeouts.push(id)
    }
  }

  /**
   * Trigger playback of a single sample via AudioBufferSourceNode.
   */
  private playSample(midi: number | null, duration: number, velocity: number): void {
    if (!this.audioContext || midi === null) return
    const buffer = this.buffers.get(midi)
    if (!buffer) return

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer

    const gainNode = this.audioContext.createGain()
    gainNode.gain.value = velocity / 127
    source.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    source.start(0)
    source.stop(this.audioContext.currentTime + duration)
    this.activeSources.push(source)
    source.onended = () => {
      const idx = this.activeSources.indexOf(source)
      if (idx !== -1) this.activeSources.splice(idx, 1)
    }
  }

  private emitEvent(type: PlaybackEventType, data: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(type) ?? []
    for (const handler of handlers) {
      try {
        handler(data)
      } catch {
        /* swallow handler errors to avoid breaking playback */
      }
    }
  }

  private clearScheduled(): void {
    for (const id of this.scheduledTimeouts) clearTimeout(id)
    this.scheduledTimeouts = []
  }
}
