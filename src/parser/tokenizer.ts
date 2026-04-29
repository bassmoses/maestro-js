import type { Token, TokenType } from './types.js'
import { MaestroError } from './errors.js'

// Matches a single note token: pitch (or R for rest), optional accidental, optional octave, optional :duration[.], optional inline dynamic
// e.g. C4:q, D#5:h., Bb3:e, R:q, C4:q(mp), C4:q(p<), C4, R:q (rest has no octave)
const NOTE_PATTERN = /^([A-GR])(##|bb|#|b)?([0-8])?(?::([whqest])(\.)?)?(?:\(([^)]+)\))?/

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

    // Barline
    if (input[i] === '|') {
      tokens.push({ type: 'BARLINE', raw: '|', position: i })
      i++
      continue
    }

    // Tie
    if (input[i] === '~') {
      tokens.push({ type: 'TIE', raw: '~', position: i })
      i++
      continue
    }

    // Chord: [...]:<duration>[.]
    if (input[i] === '[') {
      const start = i
      const end = input.indexOf(']', i)
      if (end === -1) {
        throw new MaestroError('Unclosed chord bracket "[".', input, i, 1)
      }
      // After ']', optionally consume :duration[.]
      let j = end + 1
      let durStr = ''
      if (input[j] === ':') {
        j++ // skip ':'
        if (j < input.length && /[whqest]/.test(input[j])) {
          durStr += input[j]
          j++
          if (j < input.length && input[j] === '.') {
            durStr += '.'
            j++
          }
        }
      }
      const raw = input.slice(start, j)
      tokens.push({ type: 'CHORD', raw, position: start })
      i = j
      continue
    }

    // Triplet: {...}:<duration>[.]
    if (input[i] === '{') {
      const start = i
      const end = input.indexOf('}', i)
      if (end === -1) {
        throw new MaestroError('Unclosed triplet bracket "{".', input, i, 1)
      }
      let j = end + 1
      let durStr = ''
      if (input[j] === ':') {
        j++ // skip ':'
        if (j < input.length && /[whqest]/.test(input[j])) {
          durStr += input[j]
          j++
          if (j < input.length && input[j] === '.') {
            durStr += '.'
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
      const end = input.indexOf(')', i)
      if (end === -1) {
        throw new MaestroError('Unclosed slur parenthesis "(".', input, i, 1)
      }
      const raw = input.slice(start, end + 1)
      tokens.push({ type: 'SLUR', raw, position: start })
      i = end + 1
      continue
    }

    // Note or Rest: match note pattern
    if (/[A-GR]/.test(input[i])) {
      const remaining = input.slice(i)
      const match = remaining.match(NOTE_PATTERN)
      if (!match) {
        throw new MaestroError(
          `Unrecognized note token "${remaining.split(/\s/)[0]}" at position ${i}.`,
          input,
          i,
          remaining.split(/\s/)[0].length
        )
      }
      const raw = match[0]
      tokens.push({ type: 'NOTE', raw, position: i })
      i += raw.length
      continue
    }

    // Unknown character
    throw new MaestroError(
      `Unexpected character "${input[i]}" at position ${i}.`,
      input,
      i,
      1
    )
  }

  return tokens
}
