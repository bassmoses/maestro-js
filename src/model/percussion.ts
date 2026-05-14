export const PERCUSSION_INSTRUMENTS = [
  'KICK',
  'SNARE',
  'HIHAT',
  'HIHAT_OPEN',
  'CRASH',
  'RIDE',
  'TOM_HIGH',
  'TOM_MID',
  'TOM_LOW',
] as const

export type PercussionInstrument = (typeof PERCUSSION_INSTRUMENTS)[number]

/** Standard GM drum map: instrument name -> MIDI note number (channel 10). */
export const GM_DRUM_MAP: Record<PercussionInstrument, number> = {
  KICK: 36,
  SNARE: 38,
  HIHAT: 42,
  HIHAT_OPEN: 46,
  CRASH: 49,
  RIDE: 51,
  TOM_HIGH: 50,
  TOM_MID: 47,
  TOM_LOW: 45,
}
