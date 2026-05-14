export interface NoteEvent {
  pitch: string | null // 'C4', 'D#5', null for rest
  midi: number | null
  frequency: number | null
  duration: number // in seconds
  velocity: number // 0–127 based on dynamic
  dynamic: string | null // raw dynamic string (e.g. 'p', 'f', 'cresc', 'decresc', null)
  voice: string
  measure: number
  beat: number
  tied: boolean
  chord: boolean
  glissando?: boolean
}

export interface BeatEvent {
  time: number // absolute time in seconds
  measure: number
  beat: number
}

export interface TimelineEvent {
  time: number // absolute start time in seconds
  note: NoteEvent
}

export type Timeline = TimelineEvent[]

export interface NoteTimingEvent {
  measureIndex: number // 0-based measure number
  beatIndex: number // 0-based beat within measure
  noteIndex: number // 0-based index in the flat timeline
  time: number // absolute time in seconds
  duration: number // note duration in seconds
  pitches: Array<string | null> // e.g. ['C4'] or [null] for rest; multi-pitch for chords
  voice: string
}

export interface TimingCallbackOptions {
  onNote?: (event: NoteTimingEvent) => void
  onBeat?: (measureIndex: number, beatIndex: number) => void
  onMeasure?: (measureIndex: number) => void
  onEnd?: () => void
}
