export interface NoteEvent {
  pitch: string | null // 'C4', 'D#5', null for rest
  midi: number | null
  frequency: number | null
  duration: number // in seconds
  velocity: number // 0–127 based on dynamic
  voice: string
  measure: number
  beat: number
  tied: boolean
  chord: boolean
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
