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
