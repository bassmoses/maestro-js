import * as Tone from 'tone'
import type { Score } from '../../model/Score.js'
import type { Timeline, TimelineEvent } from '../../scheduler/timeline.js'
import { Scheduler } from '../../scheduler/Scheduler.js'
import { getInstrument } from './instruments/index.js'

// Map MIDI velocity (0-127) to Tone.js volume in dB
function velocityToGain(velocity: number): number {
  return velocity / 127
}

export interface PlaybackOptions {
  voices?: string[]
  solo?: boolean
  instrument?: string
}

export type PlaybackEventType = 'beat' | 'note' | 'measure' | 'end'
export type PlaybackEventHandler = (data: Record<string, unknown>) => void

export interface AudioEffects {
  reverb?: number // 0-1 wet mix
  delay?: number // 0-1 wet mix
  chorus?: number // 0-1 wet mix
}

interface ScheduledVoice {
  name: string
  synth: Tone.PolySynth
}

/**
 * Audio playback adapter wrapping Tone.js.
 * Schedules notes from a Score's timeline onto the Tone.js Transport.
 */
export class ToneAdapter {
  private score: Score | null = null
  private timeline: Timeline = []
  private voices: Map<string, ScheduledVoice> = new Map()
  private scheduledIds: number[] = []
  private eventHandlers: Map<PlaybackEventType, PlaybackEventHandler[]> = new Map()
  private _isPlaying = false
  private _isPaused = false
  private instrumentName = 'piano'
  private lastMeasure = -1
  private lastBeat = -1
  private effectNodes: Tone.ToneAudioNode[] = []

  /**
   * Ensure the audio context is started (required by browsers after user gesture).
   */
  static async ensureAudioContext(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
  }

  /**
   * Load a score for playback. Builds the timeline and creates synths.
   */
  load(score: Score, options?: PlaybackOptions): void {
    this.dispose()
    this.score = score
    this.instrumentName = options?.instrument ?? 'piano'
    this.timeline = Scheduler.mergeTies(Scheduler.buildTimeline(score))

    // Determine which voices to include
    const allVoices = new Set(this.timeline.map((e) => e.note.voice))
    let activeVoices: Set<string>

    if (options?.voices?.length) {
      if (options.solo) {
        activeVoices = new Set(options.voices)
      } else {
        activeVoices = allVoices
      }
    } else {
      activeVoices = allVoices
    }

    // Create a synth per voice
    for (const voiceName of activeVoices) {
      const config = getInstrument(this.instrumentName)
      const synth = config.createSynth()
      synth.toDestination()
      this.voices.set(voiceName, { name: voiceName, synth })
    }

    // Filter timeline to active voices
    if (options?.voices?.length && options.solo) {
      this.timeline = this.timeline.filter((e) => activeVoices.has(e.note.voice))
    }
  }

  /**
   * Schedule all timeline events onto the Tone.js Transport and start playback.
   */
  async play(): Promise<void> {
    if (this._isPlaying && !this._isPaused) return
    if (!this.score) throw new Error('No score loaded. Call load() before play().')
    if (this._isPaused) {
      Tone.getTransport().start()
      this._isPaused = false
      this._isPlaying = true
      return
    }

    await ToneAdapter.ensureAudioContext()

    const transport = Tone.getTransport()
    transport.cancel()
    transport.seconds = 0
    this.scheduledIds = []
    this.lastMeasure = -1

    // Schedule each note event
    for (const event of this.timeline) {
      const voice = this.voices.get(event.note.voice)
      if (!voice) continue

      const id = transport.schedule((time) => {
        this.playNoteEvent(event, voice.synth, time)
        this.emitNoteEvent(event)
        this.emitMeasureEvent(event)
        this.emitBeatEvent(event)
      }, event.time)

      this.scheduledIds.push(id)
    }

    // Configure loop if set on the score
    const loopRange = this.score.getLoop()
    if (loopRange) {
      const loopStart = this.findTimeAtPosition(loopRange.startMeasure, 0)
      const loopEndEvents = this.timeline.filter((e) => e.note.measure === loopRange.endMeasure)
      const lastEventInLoop =
        loopEndEvents.length > 0
          ? Math.max(...loopEndEvents.map((e) => e.time + e.note.duration))
          : this.getTotalDuration()

      if (loopStart >= 0) {
        transport.loop = true
        transport.loopStart = loopStart
        transport.loopEnd = lastEventInLoop + 0.05
        transport.seconds = loopStart
      }
    } else {
      transport.loop = false
      // Schedule end event (only when not looping)
      const totalDuration = this.getTotalDuration()
      transport.schedule(() => {
        this.emitEvent('end', { time: totalDuration })
        this.stop()
      }, totalDuration + 0.05) // small buffer after last note ends
    }

    transport.start()
    this._isPlaying = true
    this._isPaused = false
  }

  /**
   * Pause playback (resumable).
   */
  pause(): void {
    if (!this._isPlaying) return
    Tone.getTransport().pause()
    this._isPaused = true
  }

  /**
   * Stop playback and reset position.
   */
  stop(): void {
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    transport.loop = false
    this.scheduledIds = []
    this._isPlaying = false
    this._isPaused = false
    this.lastMeasure = -1
    this.lastBeat = -1

    // Release all synths
    for (const voice of this.voices.values()) {
      voice.synth.releaseAll()
    }
  }

  /**
   * Seek to a specific position (measure + beat).
   */
  seekTo(measure: number, beat: number): void {
    const targetTime = this.findTimeAtPosition(measure, beat)
    if (targetTime < 0) {
      throw new Error(
        `Cannot seek to measure ${measure}, beat ${beat}: position not found in timeline.`
      )
    }
    // Release all sounding notes before seeking
    for (const voice of this.voices.values()) {
      voice.synth.releaseAll()
    }
    Tone.getTransport().seconds = targetTime
  }

  /**
   * Register an event handler.
   */
  on(event: PlaybackEventType, handler: PlaybackEventHandler): void {
    const handlers = this.eventHandlers.get(event) ?? []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  /**
   * Remove an event handler.
   */
  off(event: PlaybackEventType, handler: PlaybackEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
  }

  /**
   * Apply audio effects to all voices.
   */
  applyEffects(effects: AudioEffects): void {
    // Dispose old effect nodes
    for (const node of this.effectNodes) {
      node.dispose()
    }
    this.effectNodes = []

    const chain: Tone.ToneAudioNode[] = []

    if (effects.reverb != null && effects.reverb > 0) {
      const reverb = new Tone.Reverb({ decay: 2.5, wet: effects.reverb })
      chain.push(reverb)
      this.effectNodes.push(reverb)
    }

    if (effects.delay != null && effects.delay > 0) {
      const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: effects.delay })
      chain.push(delay)
      this.effectNodes.push(delay)
    }

    if (effects.chorus != null && effects.chorus > 0) {
      const chorus = new Tone.Chorus({
        frequency: 1.5,
        delayTime: 3.5,
        depth: 0.7,
        wet: effects.chorus,
      }).start()
      chain.push(chorus)
      this.effectNodes.push(chorus)
    }

    // Reconnect all voices through the effect chain
    for (const voice of this.voices.values()) {
      voice.synth.disconnect()
      if (chain.length > 0) {
        voice.synth.chain(...chain, Tone.getDestination())
      } else {
        voice.synth.toDestination()
      }
    }
  }

  /**
   * Clean up all synths and reset state.
   */
  dispose(): void {
    this.stop()
    for (const voice of this.voices.values()) {
      voice.synth.dispose()
    }
    for (const node of this.effectNodes) {
      node.dispose()
    }
    this.effectNodes = []
    this.voices.clear()
    this.timeline = []
    this.score = null
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get isPaused(): boolean {
    return this._isPaused
  }

  /**
   * Get total duration of the loaded score in seconds.
   */
  getTotalDuration(): number {
    if (this.timeline.length === 0) return 0
    return Math.max(...this.timeline.map((e) => e.time + e.note.duration))
  }

  /**
   * Get current playback position in seconds.
   */
  getCurrentTime(): number {
    return Tone.getTransport().seconds
  }

  // ─── Private ─────────────────────────────────────────────────

  private playNoteEvent(event: TimelineEvent, synth: Tone.PolySynth, audioTime: number): void {
    const { note } = event
    if (!note.pitch) return // skip rests

    const gain = velocityToGain(note.velocity)
    synth.triggerAttackRelease(note.pitch, note.duration, audioTime, gain)
  }

  private emitNoteEvent(event: TimelineEvent): void {
    this.emitEvent('note', {
      pitch: event.note.pitch,
      voice: event.note.voice,
      duration: event.note.duration,
      time: event.time,
      velocity: event.note.velocity,
      midi: event.note.midi,
      measure: event.note.measure,
      beat: event.note.beat,
    })
  }

  private emitBeatEvent(event: TimelineEvent): void {
    if (event.note.beat !== this.lastBeat) {
      this.lastBeat = event.note.beat
      this.emitEvent('beat', {
        beat: event.note.beat,
        measure: event.note.measure,
        time: event.time,
      })
    }
  }

  private emitMeasureEvent(event: TimelineEvent): void {
    if (event.note.measure !== this.lastMeasure) {
      this.lastMeasure = event.note.measure
      this.emitEvent('measure', {
        measure: event.note.measure,
        time: event.time,
      })
    }
  }

  private emitEvent(type: PlaybackEventType, data: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(type) ?? []
    for (const handler of handlers) {
      try {
        handler(data)
      } catch {
        // swallow handler errors to avoid breaking playback
      }
    }
  }

  private findTimeAtPosition(measure: number, beat: number): number {
    for (const event of this.timeline) {
      if (event.note.measure === measure && event.note.beat >= beat) {
        return event.time
      }
    }
    return -1
  }
}
