import type { Score } from '../../model/Score.js'
import type { VoiceModel } from '../../model/VoiceModel.js'
import type { Measure } from '../../model/Measure.js'
import type { RenderOptions } from './types.js'
import { DEFAULT_RENDER_OPTIONS } from './types.js'

export interface StaveLine {
  measures: readonly Measure[]
  measureStartIndex: number // 1-based measure number of the first measure in this line
  y: number // vertical position of this line
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

const STAVE_HEIGHT = 120 // pixels between stave lines
const TITLE_HEIGHT = 60 // pixels reserved for title/composer
const STAVE_SPACING = 30 // spacing between grand staff staves

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
  let y = opts.padding

  for (let i = 0; i < measures.length; i += opts.measuresPerLine) {
    const lineMeasures = measures.slice(i, i + opts.measuresPerLine)
    lines.push({
      measures: lineMeasures,
      measureStartIndex: i + 1,
      y,
    })
    y += STAVE_HEIGHT
  }

  return {
    lines,
    width: opts.width,
    totalHeight: y + opts.padding,
    staveWidth,
    measureWidth,
  }
}

/**
 * Build layouts for all voices in a score, suitable for multi-staff rendering.
 */
export function buildScoreLayout(
  score: Score,
  options: RenderOptions = {}
): {
  voiceLayouts: VoiceLayout[]
  totalHeight: number
  titleHeight: number
} {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
  const voiceLayouts: VoiceLayout[] = []
  const hasTitleOrComposer = score.title || score.composer
  const titleHeight = hasTitleOrComposer ? TITLE_HEIGHT : 0

  let currentY = opts.padding + titleHeight

  for (const part of score.getParts()) {
    for (const voice of part.getVoices()) {
      const measures = voice.getMeasures()
      const staveWidth = opts.width - opts.padding * 2
      const measureWidth = staveWidth / opts.measuresPerLine

      const lines: StaveLine[] = []
      for (let i = 0; i < measures.length; i += opts.measuresPerLine) {
        const lineMeasures = measures.slice(i, i + opts.measuresPerLine)
        lines.push({
          measures: lineMeasures,
          measureStartIndex: i + 1,
          y: currentY,
        })
        currentY += STAVE_HEIGHT
      }

      voiceLayouts.push({
        voiceName: voice.name,
        clef: voice.clef,
        layout: {
          lines,
          width: opts.width,
          totalHeight: 0, // set below
          staveWidth,
          measureWidth,
        },
      })

      if (opts.grandStaff) {
        currentY += STAVE_SPACING
      }
    }
  }

  const totalHeight = currentY + opts.padding
  // Update all layouts with final height
  for (const vl of voiceLayouts) {
    vl.layout.totalHeight = totalHeight
  }

  return { voiceLayouts, totalHeight, titleHeight }
}

export { STAVE_HEIGHT, TITLE_HEIGHT, STAVE_SPACING }
