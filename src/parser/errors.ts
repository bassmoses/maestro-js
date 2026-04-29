export class MaestroError extends Error {
  constructor(
    message: string,
    public readonly input?: string,
    public readonly position?: number,
    public readonly length?: number,
    public readonly suggestion?: string
  ) {
    super(message)
    this.name = 'MaestroError'
  }

  format(): string {
    const lines: string[] = [`${this.name}: ${this.message}`]

    if (this.input !== undefined && this.position !== undefined) {
      lines.push(`  Input: "${this.input}"`)

      const arrowLength = this.length ?? 1
      const padding = ' '.repeat(this.position + 10) // 10 = length of '  Input: "'
      const arrows = '^'.repeat(arrowLength)
      lines.push(`${padding}${arrows}`)
    }

    if (this.suggestion) {
      lines.push(`  ${this.suggestion}`)
    }

    return lines.join('\n')
  }
}

const VALID_NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/**
 * Suggest a valid note name for a mistyped pitch character.
 * Uses simple character-distance heuristics.
 */
export function suggestPitch(invalid: string): string | null {
  const upper = invalid.toUpperCase()

  // Common mistakes: H → A or B (German notation), I → no match, etc.
  const KNOWN_MISTAKES: Record<string, string> = {
    H: 'A', // German B natural
    I: 'A',
    J: 'G',
    K: 'G',
    L: 'A',
    M: 'A',
    N: 'G',
    O: 'G',
    P: 'G',
    Q: 'G',
    S: 'A',
    T: 'G',
    U: 'A',
    V: 'G',
    W: 'A',
    X: 'A',
    Y: 'A',
    Z: 'A',
  }

  if (KNOWN_MISTAKES[upper]) {
    return KNOWN_MISTAKES[upper]
  }

  // Character code proximity
  const code = upper.charCodeAt(0)
  let closest: string | null = null
  let closestDist = Infinity
  for (const name of VALID_NOTE_NAMES) {
    const dist = Math.abs(name.charCodeAt(0) - code)
    if (dist < closestDist) {
      closestDist = dist
      closest = name
    }
  }
  return closest
}
