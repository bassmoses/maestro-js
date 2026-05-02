import type { Token } from './types.js'
import { MaestroError, suggestPitch } from './errors.js'

// Matches a single note token: pitch (or R for rest), optional accidental, optional octave, optional :duration[.],
// up to two optional inline modifiers (dynamic/fermata/articulation), optional "lyric"
// e.g. C4:q, D#5:h., Bb3:e, R:q, C4:q(mp), C4:q(p<), C4, R:q (rest has no octave), C4:q"hello"
// Two modifier groups allow combinations like C4:q(staccato)(fermata)
const NOTE_PATTERN =
  /^([A-GR])(##|bb|#|b)?([0-8])?(?::([whqest])(\.)?)?(?:\(([^)]+)\))?(?:\(([^)]+)\))?(?:"([^"]*)")?/

/**
 * Determine if a `(` at position `pos` in `input` starts a SLUR (not a dynamic).
 * A slur starts when `(` is immediately followed by a note-like pattern:
 *   letter A–G, optionally accidental, octave digit
 */
function isSlurStart(input: string, pos: number): boolean {
  const rest = input.slice(pos + 1)
  // A slur starts with a note: [A-G](##|bb|#|b)?[0-9]
  return /^[A-G](##|bb|#|b)?[0-8]/.test(rest)
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++
      continue
    }

    // Barline or Repeat markers
    if (input[i] === '|') {
      // |: repeat start
      if (input[i + 1] === ':') {
        tokens.push({ type: 'REPEAT_START', raw: '|:', position: i })
        i += 2
        continue
      }
      tokens.push({ type: 'BARLINE', raw: '|', position: i })
      i++
      continue
    }

    // :| repeat end
    if (input[i] === ':' && input[i + 1] === '|') {
      tokens.push({ type: 'REPEAT_END', raw: ':|', position: i })
      i += 2
      continue
    }

    // D.C. (Da Capo)
    if (input.slice(i, i + 4) === 'D.C.') {
      tokens.push({ type: 'DA_CAPO', raw: 'D.C.', position: i })
      i += 4
      continue
    }

    // D.S. (Dal Segno)
    if (input.slice(i, i + 4) === 'D.S.') {
      tokens.push({ type: 'DAL_SEGNO', raw: 'D.S.', position: i })
      i += 4
      continue
    }

    // Segno marker (𝄋 or the word)
    if (input.slice(i, i + 5) === 'Segno') {
      tokens.push({ type: 'SEGNO', raw: 'Segno', position: i })
      i += 5
      continue
    }

    // Coda marker
    if (input.slice(i, i + 4) === 'Coda') {
      tokens.push({ type: 'CODA', raw: 'Coda', position: i })
      i += 4
      continue
    }

    // Fine marker
    if (input.slice(i, i + 4) === 'Fine') {
      tokens.push({ type: 'FINE', raw: 'Fine', position: i })
      i += 4
      continue
    }

    // Volta ending: |1. or |2. or |3. (must follow a barline character)
    // We check if the previous token was BARLINE, REPEAT_START or REPEAT_END
    // and current char is a digit followed by '.'
    // Actually, detect standalone volta markers like 1. 2. at start of measure
    if (/[1-9]/.test(input[i]) && input[i + 1] === '.') {
      tokens.push({ type: 'VOLTA', raw: input.slice(i, i + 2), position: i })
      i += 2
      continue
    }

    // Glissando: ~>
    if (input[i] === '~' && input[i + 1] === '>') {
      tokens.push({ type: 'GLISSANDO', raw: '~>', position: i })
      i += 2
      continue
    }

    // Chord symbol: @"Cmaj7"
    if (input[i] === '@' && input[i + 1] === '"') {
      const closeQuote = input.indexOf('"', i + 2)
      if (closeQuote === -1) {
        throw new MaestroError('Unclosed chord symbol quote.', input, i, 2)
      }
      const symbol = input.slice(i + 2, closeQuote)
      tokens.push({ type: 'CHORD_SYMBOL', raw: symbol, position: i })
      i = closeQuote + 1
      continue
    }

    // Tie or Grace note
    // ~ followed by a note-letter (possibly with whitespace) at the start or after a non-note token = grace note
    // ~ after a note token (connecting same pitches) = tie
    if (input[i] === '~') {
      const afterTilde = input.slice(i + 1)
      const whitespaceLen = afterTilde.length - afterTilde.trimStart().length
      const rest = afterTilde.trimStart()
      const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null
      const nextIsNote = /^[A-G]/.test(rest)
      // Grace note: ~ at start, or ~ after a barline/non-note token, followed by a note
      const isGraceNote = nextIsNote && (!prevToken || prevToken.type !== 'NOTE')
      if (isGraceNote) {
        const graceMatch = rest.match(/^([A-G])(##|bb|#|b)?([0-8])?/)
        if (graceMatch) {
          const totalLen = 1 + whitespaceLen + graceMatch[0].length // ~, whitespace, note
          tokens.push({ type: 'GRACE_NOTE', raw: '~' + graceMatch[0], position: i })
          i += totalLen
          continue
        }
      }
      tokens.push({ type: 'TIE', raw: '~', position: i })
      i++
      continue
    }

    // Rehearsal mark: [A], [B], [1], [12] — only letters/digits inside, no ':' after ']'
    // Must be distinguished from chord tokens like [C4 E4 G4]:q
    if (input[i] === '[') {
      const start = i
      const end = input.indexOf(']', i)
      if (end === -1) {
        throw new MaestroError('Unclosed bracket "[".', input, i, 1)
      }
      const inner = input.slice(start + 1, end)
      // A rehearsal mark: 1–3 chars, no spaces, no note-letter+digit pattern.
      // Chord inners always contain a note letter (A-G) directly followed by a digit (octave).
      // Rehearsal marks may be all-letters ([A], [B]) or all-digits ([1], [12]).
      // Rehearsal mark if content is short alphanumeric AND doesn't match note+optional-accidental+octave pattern
      // Note: [E], [G] etc. (single letter, no octave) are treated as rehearsal marks, not single-note chords
      const isRehearsalMark =
        /^[A-Za-z0-9]{1,3}$/.test(inner) && !/[A-G](##|bb|#|b)?[0-8]/.test(inner)
      if (isRehearsalMark) {
        const raw = input.slice(start, end + 1)
        tokens.push({ type: 'REHEARSAL_MARK', raw, position: start })
        i = end + 1
        continue
      }

      // Chord: [...]:<duration>[.][(<dynamic>)]
      // After ']', optionally consume :duration[.] and optional (dynamic)
      let j = end + 1
      if (input[j] === ':') {
        j++ // skip ':'
        if (j < input.length && /[whqest]/.test(input[j])) {
          j++
          if (j < input.length && input[j] === '.') {
            j++
          }
        }
      }
      // Optionally consume inline dynamic: (mp), (ff), (p<), etc.
      if (j < input.length && input[j] === '(') {
        const dynEnd = input.indexOf(')', j)
        if (dynEnd !== -1) {
          j = dynEnd + 1
        }
      }
      // Optionally consume lyric: "text"
      if (j < input.length && input[j] === '"') {
        const lyricEnd = input.indexOf('"', j + 1)
        if (lyricEnd !== -1) {
          j = lyricEnd + 1
        }
      }
      const raw = input.slice(start, j)
      tokens.push({ type: 'CHORD', raw, position: start })
      i = j
      continue
    }

    // Expression text: {text} — freeform text label like {soli}, {tutti}, {a tempo}
    // Must be distinguished from triplet tokens like {C4 D4 E4}:q
    // An expression text token has no ':' immediately after the closing '}'
    if (input[i] === '{') {
      const start = i
      const end = input.indexOf('}', i)
      if (end === -1) {
        throw new MaestroError('Unclosed brace "{".', input, i, 1)
      }
      const inner = input.slice(start + 1, end)
      const afterBrace = input[end + 1]
      // Expression text: inner contains no note-like pattern and no ':' follows
      // Also detect general tuplet syntax: {N: notes}:dur where N is a digit
      const isTuplet =
        afterBrace === ':' || /^[A-G]/.test(inner.trimStart()) || /^\d+\s*:/.test(inner.trimStart())
      if (!isTuplet) {
        // Expression text token
        const raw = input.slice(start, end + 1)
        tokens.push({ type: 'EXPRESSION_TEXT', raw, position: start })
        i = end + 1
        continue
      }

      // Triplet: {...}:<duration>[.]
      let j = end + 1
      if (input[j] === ':') {
        j++ // skip ':'
        if (j < input.length && /[whqest]/.test(input[j])) {
          j++
          if (j < input.length && input[j] === '.') {
            j++
          }
        }
      }
      const raw = input.slice(start, j)
      tokens.push({ type: 'TRIPLET', raw, position: start })
      i = j
      continue
    }

    // Slur: (...) — only when ( is followed by a note
    if (input[i] === '(' && isSlurStart(input, i)) {
      const start = i
      // Find matching close paren using depth counter to handle nested parens
      let depth = 1
      let j = start + 1
      while (j < input.length && depth > 0) {
        if (input[j] === '(') depth++
        if (input[j] === ')') depth--
        if (depth > 0) j++
        else break
      }
      if (depth !== 0) {
        throw new MaestroError('Unclosed slur parenthesis "(".', input, start, 1)
      }
      const raw = input.slice(start, j + 1)
      tokens.push({ type: 'SLUR', raw, position: start })
      i = j + 1
      continue
    }

    // Note or Rest: match note pattern
    if (/[A-GR]/.test(input[i])) {
      const remaining = input.slice(i)
      const match = remaining.match(NOTE_PATTERN)
      if (!match) {
        const badToken = remaining.split(/\s/)[0]
        throw new MaestroError(
          `Unrecognized note token "${badToken}" at position ${i}.`,
          input,
          i,
          badToken.length
        )
      }
      const raw = match[0]
      tokens.push({ type: 'NOTE', raw, position: i })
      i += raw.length
      continue
    }

    // Check if it's a letter that looks like a note but isn't A-G
    if (/[a-zA-Z]/.test(input[i])) {
      const badToken = input.slice(i).split(/[\s|~[\]{}()]/)[0]
      const suggestion = suggestPitch(input[i])
      const hint = suggestion
        ? `"${input[i]}" is not a valid note name. Valid notes are: C D E F G A B\n  Did you mean: ${suggestion}${badToken.slice(1)}?`
        : `"${input[i]}" is not a valid note name. Valid notes are: C D E F G A B`
      throw new MaestroError(
        `Unrecognized note token "${badToken}" at position ${i}.`,
        input,
        i,
        badToken.length,
        hint
      )
    }

    // Unknown character
    throw new MaestroError(`Unexpected character "${input[i]}" at position ${i}.`, input, i, 1)
  }

  return tokens
}
