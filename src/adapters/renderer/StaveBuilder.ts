import type { Score } from '../../model/Score.js'
import type { VoiceModel } from '../../model/VoiceModel.js'
import type { Measure } from '../../model/Measure.js'
import type { RenderOptions } from './types.js'
import { DEFAULT_RENDER_OPTIONS } from './types.js'

export interface StaveLine {
  measures: readonly Measure[]
  measureStartIndex: number // 1-based measure number of the first measure in this line
  y: number // LOCAL y within the system container (not global score y)
}

export interface StaveLayout {
  lines: StaveLine[]
  width: number
  totalHeight: number
  staveWidth: number // usable width for each stave (minus padding)
  measureWidth: number // width per measure
}

export interface VoiceLayout {
  voiceName: string
  clef: string
  layout: StaveLayout
}

const STAVE_HEIGHT = 120 // pixels between stave baselines
const TITLE_HEIGHT = 60 // pixels reserved for title/composer
const STAVE_SPACING = 30 // extra gap between grand staff staves

/**
 * Calculate the layout of staves for a score.
 * Determines how many measures per line, wrapping, and vertical positioning.
 */
export function buildStaveLayout(voice: VoiceModel, options: RenderOptions = {}): StaveLayout {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
  const measures = voice.getMeasures()
  const staveWidth = opts.width - opts.padding * 2
  const measureWidth = staveWidth / opts.measuresPerLine

  const lines: StaveLine[] = []
  const y = opts.padding // single voice: always at top of its container

  for (let i = 0; i < measures.length; i += opts.measuresPerLine) {
    const lineMeasures = measures.slice(i, i + opts.measuresPerLine)
    lines.push({
      measures: lineMeasures,
      measureStartIndex: i + 1,
      y,
    })
  }

  return {
    lines,
    width: opts.width,
    totalHeight: opts.padding * 2 + STAVE_HEIGHT,
    staveWidth,
    measureWidth,
  }
}

/**
 * Build layouts for all voices in a score, suitable for multi-staff rendering.
 *
 * Each VoiceLayout's StaveLine.y is LOCAL to the system container — i.e.
 * the y offset within one row of music, not an absolute score-level position.
 * The caller creates one renderer per system line and uses these local y values.
 */
export function buildScoreLayout(
  score: Score,
  options: RenderOptions = {}
): {
  voiceLayouts: VoiceLayout[]
  numLines: number
  systemHeight: number
  titleHeight: number
  totalHeight: number
} {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
  const voiceLayouts: VoiceLayout[] = []
  const hasTitleOrComposer = score.title || score.composer
  const titleHeight = hasTitleOrComposer ? TITLE_HEIGHT : 0

  const parts = score.getParts()
  const allVoices: Array<{ voice: VoiceModel; voiceIndex: number }> = []
  for (const part of parts) {
    for (const voice of part.getVoices()) {
      allVoices.push({ voice, voiceIndex: allVoices.length })
    }
  }

  const numVoices = allVoices.length
  const staveWidth = opts.width - opts.padding * 2
  const measureWidth = staveWidth / opts.measuresPerLine

  // System height: all voices stacked, with optional grand staff spacing between them
  const spacingBetween = opts.grandStaff ? STAVE_SPACING : 0
  const systemHeight =
    opts.padding + numVoices * STAVE_HEIGHT + (numVoices - 1) * spacingBetween + opts.padding

  // numLines = max measure lines across all voices (they should all be equal)
  let maxMeasures = 0
  for (const { voice } of allVoices) {
    maxMeasures = Math.max(maxMeasures, voice.getMeasures().length)
  }
  const numLines = Math.ceil(maxMeasures / opts.measuresPerLine)

  for (const { voice, voiceIndex } of allVoices) {
    const measures = voice.getMeasures()
    // Local y for this voice within each system container
    const localY = opts.padding + voiceIndex * (STAVE_HEIGHT + spacingBetween)

    const lines: StaveLine[] = []
    for (let i = 0; i < numLines; i++) {
      const lineMeasures = measures.slice(i * opts.measuresPerLine, (i + 1) * opts.measuresPerLine)
      lines.push({
        measures: lineMeasures,
        measureStartIndex: i * opts.measuresPerLine + 1,
        y: localY,
      })
    }

    voiceLayouts.push({
      voiceName: voice.name,
      clef: voice.clef,
      layout: {
        lines,
        width: opts.width,
        totalHeight: systemHeight,
        staveWidth,
        measureWidth,
      },
    })
  }

  const totalHeight = titleHeight + numLines * systemHeight
  return { voiceLayouts, numLines, systemHeight, titleHeight, totalHeight }
}

export { STAVE_HEIGHT, TITLE_HEIGHT, STAVE_SPACING }
