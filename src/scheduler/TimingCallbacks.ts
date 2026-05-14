import type { Timeline, NoteTimingEvent, TimingCallbackOptions } from './timeline.js'

/**
 * Pure data class wrapping a Timeline.
 * Provides note-at-time lookup, progress tracking, and NoteTimingEvent mapping.
 * No audio references — wired to ToneAdapter externally (Task 10).
 */
export class TimingCallbacks {
  private readonly timeline: Timeline
  private readonly callbacks: TimingCallbackOptions
  private readonly _totalDuration: number
  private _cachedNoteEvents: NoteTimingEvent[] | null = null

  constructor(timeline: Timeline, callbacks: TimingCallbackOptions) {
    this.timeline = timeline
    this.callbacks = callbacks
    this._totalDuration =
      timeline.length > 0
        ? timeline[timeline.length - 1].time + timeline[timeline.length - 1].note.duration
        : 0
  }

  /**
   * Build flat NoteTimingEvent array from the timeline.
   * measureIndex is 0-based (timeline stores 1-based measure numbers).
   * Result is cached since timeline is immutable after construction.
   */
  buildNoteEvents(): NoteTimingEvent[] {
    if (this._cachedNoteEvents) return this._cachedNoteEvents

    let beatWithinMeasure = 0
    let prevMeasureIndex = -1

    const result = this.timeline.map((ev, idx) => {
      const measureIndex = ev.note.measure - 1 // 1-based → 0-based
      if (measureIndex !== prevMeasureIndex) {
        beatWithinMeasure = 0
        prevMeasureIndex = measureIndex
      }
      const event: NoteTimingEvent = {
        measureIndex,
        beatIndex: beatWithinMeasure,
        noteIndex: idx,
        time: ev.time,
        duration: ev.note.duration,
        pitches: [ev.note.pitch],
        voice: ev.note.voice,
      }
      if (!ev.note.chord) {
        beatWithinMeasure++
      }
      return event
    })

    this._cachedNoteEvents = result
    return this._cachedNoteEvents
  }

  /**
   * Return the NoteTimingEvent active at the given audio time, or null.
   */
  getNoteAt(audioTime: number): NoteTimingEvent | null {
    for (const ev of this.buildNoteEvents()) {
      if (ev.time <= audioTime && audioTime < ev.time + ev.duration) {
        return ev
      }
    }
    return null
  }

  /**
   * Return playback progress as a fraction 0–1.
   */
  getProgress(audioTime: number): number {
    if (this._totalDuration === 0) return 0
    return Math.min(1, Math.max(0, audioTime / this._totalDuration))
  }

  get options(): TimingCallbackOptions {
    return this.callbacks
  }

  get duration(): number {
    return this._totalDuration
  }
}
