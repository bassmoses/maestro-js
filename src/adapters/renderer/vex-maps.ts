import type { DurationName, Dynamic } from '../../model/types.js'

export const DURATION_MAP: Record<DurationName, string> = {
  w: 'w',
  h: 'h',
  q: 'q',
  e: '8',
  s: '16',
  t: '32',
}

export const ACCIDENTAL_MAP: Record<string, string> = {
  '#': '#',
  b: 'b',
  '##': '##',
  bb: 'bb',
}

export const ARTICULATION_MAP: Record<string, string> = {
  staccato: 'a.',
  accent: 'a>',
  tenuto: 'a-',
  marcato: 'a^',
}

export const ORNAMENT_MAP: Record<string, string> = {
  trill: 'tr',
  mordent: 'mordent',
  turn: 'turn',
}

export const DYNAMIC_MAP: Record<Dynamic, string> = {
  ppp: 'ppp',
  pp: 'pp',
  p: 'p',
  mp: 'mp',
  mf: 'mf',
  f: 'f',
  ff: 'ff',
  fff: 'fff',
  cresc: 'cresc',
  decresc: 'decresc',
}

export const BEAMABLE_DURATIONS = new Set(['8', '16', '32'])
