declare module 'midi-writer-js' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TrackOptions {
    // empty — Track is created without options
  }

  interface NoteEventOptions {
    pitch: string | string[]
    duration: string | string[]
    velocity?: number
    wait?: string | string[]
    sequential?: boolean
    channel?: number
    repeat?: number
    startTick?: number
    tick?: number
  }

  interface ProgramChangeEventOptions {
    instrument: number
  }

  class Track {
    addEvent(
      event: NoteEvent | NoteEvent[],
      mapFunction?: (event: NoteEvent, index: number) => object
    ): Track
    setTempo(bpm: number, tick?: number): Track
    setTimeSignature(
      numerator: number,
      denominator: number,
      midiclockspertick?: number,
      notespermidiclock?: number
    ): Track
    setKeySignature(sf: string, mi?: string): Track
    addTrackName(name: string): Track
    addText(text: string): Track
    addInstrumentName(name: string): Track
  }

  class NoteEvent {
    constructor(options: NoteEventOptions)
  }

  class ProgramChangeEvent {
    constructor(options: ProgramChangeEventOptions)
  }

  class Writer {
    constructor(tracks: Track | Track[])
    buildFile(): Uint8Array
    base64(): string
    dataUri(): string
  }

  const _default: {
    Track: typeof Track
    NoteEvent: typeof NoteEvent
    ProgramChangeEvent: typeof ProgramChangeEvent
    Writer: typeof Writer
  }

  export default _default
}
