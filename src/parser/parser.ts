import type {
  NoteNode,
  PitchName,
  Accidental,
  Octave,
  DurationName,
  Dynamic,
  Articulation,
  Token,
} from './types.js'
import { tokenize } from './tokenizer.js'
import { MaestroError } from './errors.js'
import { VALID_DYNAMIC_NAMES } from './constants.js'

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
  if (raw.length > 1 && raw.endsWith('<')) return 'cresc'
  if (raw.length > 1 && raw.endsWith('>')) return 'decresc'
  if (VALID_DYNAMIC_NAMES.has(raw)) return raw as Dynamic
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
  // Regex: pitch (or R), optional accidental, optional octave, optional :duration[.],
  // up to two optional inline modifiers (dynamic/fermata/articulation), optional "lyric"
  const match = raw.match(
    /^([A-GR])(##|bb|#|b)?([0-8])?(?::([whqest])(\.)?)?(?:\(([^)]+)\))?(?:\(([^)]+)\))?(?:"([^"]*)")?$/
  )
  if (!match) {
    throw new MaestroError(`Invalid note syntax: "${raw}"`, input, position, raw.length)
  }

  const [, pitchRaw, accidentalRaw, octaveRaw, durRaw, dotRaw, mod1Raw, mod2Raw, lyricRaw] = match
  // Combine modifier groups: support both orderings (articulation+fermata or fermata+articulation)
  const modifiers = [mod1Raw, mod2Raw].filter((m): m is string => m !== undefined)

  const isRest = pitchRaw === 'R'
  const pitch: PitchName | null = isRest ? null : (pitchRaw as PitchName)
  const accidental: Accidental = (accidentalRaw ?? null) as Accidental
  const octave: Octave | null = isRest
    ? null
    : octaveRaw !== undefined
      ? (parseInt(octaveRaw, 10) as Octave)
      : null
  const duration: DurationName = (durRaw ?? 'q') as DurationName
  const dotted = dotRaw === '.'

  // Check for fermata, breath, articulation, vs dynamic across all modifier groups
  let dynamic: Dynamic | null = null
  let fermata = false
  let breath = false
  let articulation: Articulation = null
  for (const mod of modifiers) {
    if (mod === 'fermata') {
      fermata = true
    } else if (mod === 'breath') {
      breath = true
    } else if (mod === 'staccato' || mod === 'accent' || mod === 'tenuto' || mod === 'marcato') {
      articulation = mod as Articulation
    } else {
      dynamic = parseDynamicString(mod)
    }
  }

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
    fermata,
    breath,
    lyric: lyricRaw ?? undefined,
    articulation,
  }
}

/**
 * Parse a CHORD token raw string like "[C4 E4 G4]:h" or "[C4 E4 G4]:h(f)"
 */
function parseChordToken(token: Token, input: string, chordGroup: number): NoteNode[] {
  const inner = token.raw.slice(1, token.raw.lastIndexOf(']'))
  const afterBracket = token.raw.slice(token.raw.lastIndexOf(']') + 1)
  const durMatch = afterBracket.match(/^:([whqest])(\.)?/)
  const durStr: DurationName = durMatch ? (durMatch[1] as DurationName) : 'q'
  const dotted = durMatch ? durMatch[2] === '.' : false

  // Extract optional dynamic: (mp), (ff), (p<), etc.
  const dynMatch = afterBracket.match(/\(([^)]+)\)/)
  const dynamic: Dynamic | null = dynMatch ? parseDynamicString(dynMatch[1]) : null

  // Extract optional lyric: "text"
  const lyricMatch = afterBracket.match(/"([^"]*)"/)
  const lyric: string | undefined = lyricMatch ? lyricMatch[1] : undefined

  const noteStrs = inner.trim().split(/\s+/)
  return noteStrs.map((noteStr, idx) => {
    const noteMatch = noteStr.match(/^([A-G])(##|bb|#|b)?([0-8])?$/)
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
      octave: octaveRaw !== undefined ? (parseInt(octaveRaw, 10) as Octave) : null,
      duration: durStr,
      dotted,
      dynamic,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: true,
      chordGroup,
      triplet: false,
      fermata: false,
      lyric: idx === 0 ? lyric : undefined, // attach lyric to first chord note only
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
    const noteMatch = noteStr.match(/^([A-G])(##|bb|#|b)?([0-8])?$/)
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
      octave: octaveRaw !== undefined ? (parseInt(octaveRaw, 10) as Octave) : null,
      duration: noteDur,
      dotted: false,
      dynamic: null,
      tied: false,
      slurred: false,
      isBarline: false,
      chord: false,
      triplet: true,
      tripletGroup,
      fermata: false,
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
function makeBarlineNode(opts?: {
  repeatStart?: boolean
  repeatEnd?: boolean
  daCapo?: boolean
  rehearsalMark?: string
}): NoteNode {
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
    fermata: false,
    repeatStart: opts?.repeatStart,
    repeatEnd: opts?.repeatEnd,
    daCapo: opts?.daCapo,
    rehearsalMark: opts?.rehearsalMark,
  }
}

export function parse(input: string): NoteNode[] {
  const tokens = tokenize(input)
  const nodes: NoteNode[] = []
  let tripletGroupCounter = 0
  let chordGroupCounter = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    switch (token.type) {
      case 'NOTE': {
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
        const chordNodes = parseChordToken(token, input, chordGroupCounter)
        chordGroupCounter++
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

      case 'REPEAT_START': {
        nodes.push(makeBarlineNode({ repeatStart: true }))
        break
      }

      case 'REPEAT_END': {
        nodes.push(makeBarlineNode({ repeatEnd: true }))
        break
      }

      case 'DA_CAPO': {
        nodes.push(makeBarlineNode({ daCapo: true }))
        break
      }

      case 'REHEARSAL_MARK': {
        // Extract inner content: [A] -> 'A'
        const mark = token.raw.slice(1, -1)
        nodes.push(makeBarlineNode({ rehearsalMark: mark }))
        break
      }

      case 'EXPRESSION_TEXT': {
        // Extract inner content: {soli} -> 'soli'
        const text = token.raw.slice(1, -1)
        // Attach the expression to the last non-barline note
        for (let j = nodes.length - 1; j >= 0; j--) {
          if (!nodes[j].isBarline) {
            nodes[j] = { ...nodes[j], expression: text }
            break
          }
        }
        break
      }
    }
  }

  return nodes
}
