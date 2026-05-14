import type { Score } from '../../model/Score.js'

export interface ChordGridOptions {
  cellsPerRow?: number // default 4
  cellWidth?: number // default 160
  cellHeight?: number // default 100
  showBarNumbers?: boolean // default false
  fontSize?: number // default 16
}

const DEFAULTS: Required<ChordGridOptions> = {
  cellsPerRow: 4,
  cellWidth: 160,
  cellHeight: 100,
  showBarNumbers: false,
  fontSize: 16,
}

/**
 * Extract the first chord symbol from each measure across all voices of the first part.
 * Returns one entry per measure; empty string when no chord symbol is present.
 */
export function extractChordSequence(score: Score): string[] {
  const firstPart = score.getParts()[0]
  if (!firstPart) return []

  const voices = firstPart.getVoices()
  if (voices.length === 0) return []

  const maxMeasures = Math.max(...voices.map((v) => v.getMeasures().length))
  const result: string[] = []

  for (let mi = 0; mi < maxMeasures; mi++) {
    let sym = ''
    for (const voice of voices) {
      const measure = voice.getMeasures()[mi]
      if (!measure) continue
      for (const note of measure.getNotes()) {
        if (note.chordSymbol) {
          sym = note.chordSymbol
          break
        }
      }
      if (sym) break
    }
    result.push(sym)
  }

  return result
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Render a chord grid as an SVG string.
 * Each cell represents one measure: chord symbol at top, rhythm slashes in the middle,
 * and an optional bar number at bottom-left.
 */
export class ChordGridRenderer {
  static render(score: Score, options: ChordGridOptions = {}): string {
    const opts = { ...DEFAULTS, ...options }
    const chords = extractChordSequence(score)
    const numMeasures = chords.length

    if (numMeasures === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.cellWidth}" height="${opts.cellHeight}"></svg>`
    }

    const cols = opts.cellsPerRow
    const rows = Math.ceil(numMeasures / cols)
    const totalWidth = cols * opts.cellWidth
    const totalHeight = rows * opts.cellHeight

    const cells: string[] = []

    for (let i = 0; i < numMeasures; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = col * opts.cellWidth
      const y = row * opts.cellHeight
      const sym = chords[i]

      // Cell border rectangle
      cells.push(
        `<rect x="${x}" y="${y}" width="${opts.cellWidth}" height="${opts.cellHeight}" fill="none" stroke="#000" stroke-width="1"/>`
      )

      // Chord symbol text
      if (sym) {
        cells.push(
          `<text x="${x + 8}" y="${y + opts.fontSize + 6}" font-family="serif" font-size="${opts.fontSize}" font-weight="bold" fill="#000">${escapeXML(sym)}</text>`
        )
      }

      // Four rhythm slashes evenly spaced across the cell
      const slashY = y + Math.round(opts.cellHeight * 0.6)
      const slashSpacing = opts.cellWidth / 5
      for (let s = 0; s < 4; s++) {
        const sx = Math.round(x + slashSpacing * (s + 1))
        cells.push(
          `<text x="${sx}" y="${slashY}" font-family="serif" font-size="${opts.fontSize}" fill="#555" text-anchor="middle">/</text>`
        )
      }

      // Bar number
      if (opts.showBarNumbers) {
        cells.push(
          `<text x="${x + 4}" y="${y + opts.cellHeight - 4}" font-family="sans-serif" font-size="10" fill="#888">${i + 1}</text>`
        )
      }
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">`,
      ...cells,
      `</svg>`,
    ].join('\n')
  }
}
