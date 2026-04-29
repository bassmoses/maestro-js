import type { NoteNode, PitchName, Accidental, Octave, DurationName, Dynamic, Token } from './types.js'
import { tokenize } from './tokenizer.js'
import { MaestroError } from './errors.js'

const VALID_PITCHES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
const VALID_DURATIONS = new Set<string>(['w', 'h', 'q', 'e', 's', 't'])
const VALID_DYNAMICS = new Set<string>(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'cresc', 'decresc'])

// Maps a triplet container duration to each note's duration.
// Standard: triplet quarter = 3 eighths; triplet half = 3 quarters; triplet eighth = 3 sixteenths.
const TRIPLET_NOTE_DURATION: Record<DurationName, DurationName> = {
  w: 'h',
  h: 'q',
  q: 'e',
  e: 's',
  s: 't',
  t: 't', // no smaller than t
}

/**
 * Parse an inline dynamic string like "mp", "p<", "p>", "ff", etc.
 * Returns null for unrecognized or empty strings.
 */
function parseDynamicString(raw: string): Dynamic | null {
  if (raw.endsWith('<')) return 'cresc'
  if (raw.endsWith('>')) return 'decresc'
  if (VALID_DYNAMICS.has(raw)) return raw as Dynamic
  return null
}

/**
 * Parse a single note raw string like "C4:q", "D#5:h.", "Bb3:e", "R:q", "C4:q(mp)".
 * Validation of pitch and duration is done upstream by validateNoteToken.
 */
function parseNoteRaw(
  raw: string,
  input: string,
  position: number,
  defaults: { slurred?: boolean; chord?: boolean; triplet?: boolean; tripletGroup?: number } = {}
): NoteNode {
  // Regex: pitch (or R), optional accidental, optional octave, optional :duration[.], optional inline dynamic
  const match = raw.match(
    /^([A-GR])(##|bb|#|b)?([0-8])?(?::([whqest])(\.)?)?(?:\(([^)]+)\))?$/
  )!
  // Note: match is guaranteed non-null because the tokenizer already validated this

  const [, pitchRaw, accidentalRaw, octaveRaw, durRaw, dotRaw, dynRaw] = match

  const isRest = pitchRaw === 'R'
  const pitch: PitchName | null = isRest ? null : (pitchRaw as PitchName)
  const accidental: Accidental = (accidentalRaw ?? null) as Accidental
  const octave: Octave | null = isRest ? null : (octaveRaw !== undefined ? parseInt(octaveRaw, 10) as Octave : null)
  const duration: DurationName = (durRaw ?? 'q') as DurationName
  const dotted = dotRaw === '.'
  const dynamic: Dynamic | null = dynRaw !== undefined ? parseDynamicString(dynRaw) : null

  return {
    type: isRest ? 'rest' : 'note',
    pitch,
    accidental,
    octave,
    duration,
    dotted,
    dynamic,
    tied: false,
    slurred: defaults.slurred ?? false,
    isBarline: false,
    chord: defaults.chord ?? false,
    triplet: defaults.triplet ?? false,
    tripletGroup: defaults.tripletGroup,
  }
}

/**
 * Parse a CHORD token raw string like "[C4 E4 G4]:h"
 */
function parseChordToken(token: Token, input: string): NoteNode[] {
  const inner = token.raw.slice(1, token.raw.lastIndexOf(']'))
  const afterBracket = token.raw.slice(token.raw.lastIndexOf(']') + 1)
  const durMatch = afterBracket.match(/^:([whqest])(\.)?/)
  const durStr: DurationName = durMatch ? (durMatch[1] as DurationName) : 'q'
  const dotted = durMatch ? durMatch[2] === '.' : false

  const noteStrs = inner.trim().split(/\s+/)
  return noteStrs.map((noteStr) => {
    const noteMatch = noteStr.match(/^([A-G])(##|bb|#|b)?([0-8])$/)
    if (!noteMatch) {
      throw new MaestroError(
        `Invalid note in chord: "${noteStr}"`,
        input,
        token.position + 1 + inner.indexOf(noteStr),
        noteStr.length
      )
    }
    const [, pitchRaw, accidentalRaw, octaveRaw] = noteMatch

    return {
      type: 'note' as const,
      pitch: pitchRaw as PitchName,
      accidental: (accidentalRaw ?? null) as Accidental,
      octave: parseInt(octaveRaw, 10) as Octave,
      duration: durStr,
      dotted,
      dynamic: null,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: true,
      triplet: false,
    }
  })
}

/**
 * Parse a TRIPLET token raw string like "{C4 D4 E4}:q"
 */
function parseTripletToken(token: Token, input: string, tripletGroup: number): NoteNode[] {
  const inner = token.raw.slice(1, token.raw.lastIndexOf('}'))
  const afterBrace = token.raw.slice(token.raw.lastIndexOf('}') + 1)
  const durMatch = afterBrace.match(/^:([whqest])(\.)?/)
  const containerDur: DurationName = durMatch ? (durMatch[1] as DurationName) : 'q'
  const noteDur: DurationName = TRIPLET_NOTE_DURATION[containerDur]

  const noteStrs = inner.trim().split(/\s+/)
  return noteStrs.map((noteStr) => {
    const noteMatch = noteStr.match(/^([A-G])(##|bb|#|b)?([0-8])$/)
    if (!noteMatch) {
      throw new MaestroError(
        `Invalid note in triplet: "${noteStr}"`,
        input,
        token.position,
        token.raw.length
      )
    }
    const [, pitchRaw, accidentalRaw, octaveRaw] = noteMatch

    return {
      type: 'note' as const,
      pitch: pitchRaw as PitchName,
      accidental: (accidentalRaw ?? null) as Accidental,
      octave: parseInt(octaveRaw, 10) as Octave,
      duration: noteDur,
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: false,
      triplet: true,
      tripletGroup,
    }
  })
}

/**
 * Parse a SLUR token raw string like "(E4:q F4:q G4:h)"
 */
function parseSlurToken(token: Token, input: string): NoteNode[] {
  const inner = token.raw.slice(1, -1)
  const noteStrs = inner.trim().split(/\s+/)
  return noteStrs.map((noteStr) => parseNoteRaw(noteStr, input, token.position, { slurred: true }))
}

/**
 * Create a barline node.
 */
function makeBarlineNode(): NoteNode {
  return {
    type: 'note',
    pitch: null,
    accidental: null,
    octave: null,
    duration: 'q',
    dotted: false,
    dynamic: null,
    tied: false,
    slurred: false,
    isBarline: true,
    chord: false,
    triplet: false,
  }
}

/**
 * Validate a NOTE token for invalid pitch or duration before parsing.
 * The tokenizer catches unknown characters, but we need to validate
 * duration characters that appear after ':'.
 */
function validateNoteToken(token: Token, input: string): void {
  const raw = token.raw
  const firstChar = raw[0]

  // Check for invalid pitch (letter that's not A-G or R)
  if (firstChar !== 'R' && !VALID_PITCHES.has(firstChar)) {
    throw new MaestroError(
      `"${firstChar}" is not a valid note name. Valid notes are: C D E F G A B`,
      input,
      token.position,
      raw.length
    )
  }

  // Check for invalid duration character after ':'
  const durMatch = raw.match(/:([a-z])/)
  if (durMatch && !VALID_DURATIONS.has(durMatch[1])) {
    throw new MaestroError(
      `"${durMatch[1]}" is not a valid duration. Valid durations are: w h q e s t`,
      input,
      token.position,
      raw.length
    )
  }
}

export function parse(input: string): NoteNode[] {
  const tokens = tokenize(input)
  const nodes: NoteNode[] = []
  let tripletGroupCounter = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    switch (token.type) {
      case 'NOTE': {
        validateNoteToken(token, input)
        const node = parseNoteRaw(token.raw, input, token.position)
        nodes.push(node)
        break
      }

      case 'TIE': {
        // Mark the last non-barline node as tied
        for (let j = nodes.length - 1; j >= 0; j--) {
          if (!nodes[j].isBarline) {
            nodes[j] = { ...nodes[j], tied: true }
            break
          }
        }
        break
      }

      case 'CHORD': {
        const chordNodes = parseChordToken(token, input)
        nodes.push(...chordNodes)
        break
      }

      case 'TRIPLET': {
        const tripletNodes = parseTripletToken(token, input, tripletGroupCounter)
        tripletGroupCounter++
        nodes.push(...tripletNodes)
        break
      }

      case 'SLUR': {
        const slurNodes = parseSlurToken(token, input)
        nodes.push(...slurNodes)
        break
      }

      case 'BARLINE': {
        nodes.push(makeBarlineNode())
        break
      }
    }
  }

  return nodes
}
