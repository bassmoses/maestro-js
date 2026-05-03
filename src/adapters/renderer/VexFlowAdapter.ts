import {
  Renderer,
  Stave,
  StaveNote,
  Voice as VexVoice,
  Formatter,
  Beam,
  StaveTie,
  Curve,
  StaveHairpin,
  type RenderContext,
  VoiceMode,
  Annotation,
  Barline,
  StaveConnector,
} from 'vexflow'

import type { Score } from '../../model/Score.js'
import type { Measure } from '../../model/Measure.js'
import { durationToDenom } from '../../model/Duration.js'
import type { RenderOptions, ThemeColors } from './types.js'
import { DEFAULT_RENDER_OPTIONS, THEMES } from './types.js'
import { buildScoreLayout, type VoiceLayout } from './StaveBuilder.js'
import { BEAMABLE_DURATIONS } from './vex-maps.js'
import { groupNotesForRender, type RenderNote } from './render-note.js'
import { collectSpanners, buildRenderToStaveMap, type SpannerQueues } from './spanners.js'
import { createVexStaveNotes } from './modifiers.js'
import { installJsdomGlobals, createDetachedContainer, extractSVG } from './jsdom-utils.js'

export interface RenderedScore {
  svg: string
  width: number
  height: number
}

/**
 * Main VexFlow adapter — renders a Score model to SVG.
 * Works in both browser (DOM element target) and Node (SVG string export).
 *
 * One renderer (= one SVG element) is created per system line, matching
 * the VexFlow idiom from the working experiment. This prevents the shared
 * SVG context's groupAttributes stack from becoming corrupted across staves.
 */
export class VexFlowAdapter {
  static render(score: Score, target: HTMLElement, options: RenderOptions = {}): void {
    const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
    const theme = THEMES[opts.theme]
    const { voiceLayouts, numLines, systemHeight, titleHeight } = buildScoreLayout(score, opts)

    target.style.backgroundColor = theme.background

    // Title rendered into a small dedicated div above the systems
    if (score.title || score.composer) {
      const titleDiv = document.createElement('div')
      titleDiv.style.width = `${opts.width}px`
      titleDiv.style.height = `${titleHeight}px`
      titleDiv.style.position = 'relative'
      target.appendChild(titleDiv)

      const titleRenderer = new Renderer(titleDiv, Renderer.Backends.SVG)
      titleRenderer.resize(opts.width, titleHeight)
      const ctx = titleRenderer.getContext()
      ctx.setFillStyle(theme.titleColor)
      ctx.setStrokeStyle(theme.titleColor)
      renderTitleInto(ctx, score, opts, theme)
    }

    // One div + renderer per system line
    for (let li = 0; li < numLines; li++) {
      const systemDiv = document.createElement('div')
      systemDiv.style.width = `${opts.width}px`
      systemDiv.style.height = `${systemHeight}px`
      target.appendChild(systemDiv)

      const renderer = new Renderer(systemDiv, Renderer.Backends.SVG)
      renderer.resize(opts.width, systemHeight)
      const context = renderer.getContext()
      context.setFillStyle(theme.foreground)
      context.setStrokeStyle(theme.foreground)

      renderSystemLine(context, score, voiceLayouts, li, opts, theme)
    }
  }

  static renderToSVG(score: Score, options: RenderOptions = {}): RenderedScore {
    const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
    const theme = THEMES[opts.theme]
    const { voiceLayouts, numLines, systemHeight, titleHeight } = buildScoreLayout(score, opts)

    const needsJsdom = typeof document === 'undefined'
    const cleanup = needsJsdom ? installJsdomGlobals() : null

    try {
      const parts: Array<{ svg: string; height: number }> = []

      if (score.title || score.composer) {
        const titleContainer = createDetachedContainer()
        const titleRenderer = new Renderer(titleContainer, Renderer.Backends.SVG)
        titleRenderer.resize(opts.width, titleHeight)
        const ctx = titleRenderer.getContext()
        ctx.setFillStyle(theme.titleColor)
        ctx.setStrokeStyle(theme.titleColor)
        renderTitleInto(ctx, score, opts, theme)
        parts.push({ svg: extractSVG(titleContainer), height: titleHeight })
      }

      for (let li = 0; li < numLines; li++) {
        const container = createDetachedContainer()
        const renderer = new Renderer(container, Renderer.Backends.SVG)
        renderer.resize(opts.width, systemHeight)
        const context = renderer.getContext()
        context.setFillStyle(theme.foreground)
        context.setStrokeStyle(theme.foreground)

        renderSystemLine(context, score, voiceLayouts, li, opts, theme)
        parts.push({ svg: extractSVG(container), height: systemHeight })
      }

      const totalHeight = parts.reduce((sum, p) => sum + p.height, 0)
      return {
        svg: wrapSVGParts(parts, opts.width, totalHeight),
        width: opts.width,
        height: totalHeight,
      }
    } finally {
      cleanup?.()
    }
  }
}

// ─── Per-system rendering ────────────────────────────────────────

function renderSystemLine(
  context: RenderContext,
  score: Score,
  voiceLayouts: VoiceLayout[],
  li: number,
  opts: Required<RenderOptions>,
  theme: ThemeColors
): void {
  const queues: SpannerQueues = { ties: [], slurs: [], hairpins: [], glissandos: [] }

  // First-voice staves per measure index — used for grand staff connectors
  const firstVoiceStaves: Stave[] = []
  const lastVoiceStaves: Stave[] = []

  for (let vi = 0; vi < voiceLayouts.length; vi++) {
    const { layout, clef, voiceName } = voiceLayouts[vi]
    if (li >= layout.lines.length) continue

    const line = layout.lines[li]
    if (line.measures.length === 0) continue

    const isFirstLine = li === 0
    const isFirstVoice = vi === 0
    const isLastVoice = vi === voiceLayouts.length - 1

    // Clef/time-sig extra width on the first measure of the first line
    const firstMeasureExtra = isFirstLine ? 60 : 0
    const totalStaveWidth = opts.width - opts.padding * 2
    const measureWidth = (totalStaveWidth - firstMeasureExtra) / line.measures.length

    let xPos = opts.padding

    for (let mi = 0; mi < line.measures.length; mi++) {
      const measure = line.measures[mi]
      const isFirstMeasure = mi === 0
      const isLastMeasure = mi === line.measures.length - 1
      const w = isFirstMeasure ? measureWidth + firstMeasureExtra : measureWidth
      const measureNumber = line.measureStartIndex + mi

      const stave = new Stave(xPos, line.y, w)

      if (isFirstMeasure && isFirstLine) {
        stave.addClef(clef === 'treble-8' ? 'treble' : clef)
        stave.addTimeSignature(
          `${score.timeSignature.beats}/${durationToDenom(score.timeSignature.noteValue)}`
        )
        if (isFirstVoice) {
          stave.setTempo({ duration: 'q', dots: 0, bpm: score.tempo }, 0)
        }
      }

      if (opts.showBarNumbers && measureNumber > 1 && isFirstMeasure) {
        stave.setText(`${measureNumber}`)
      }

      for (const rep of score.getRepeatSections()) {
        if (rep.startMeasure === measureNumber) stave.setBegBarType(Barline.type.REPEAT_BEGIN)
        if (rep.endMeasure === measureNumber) stave.setEndBarType(Barline.type.REPEAT_END)
      }

      if (isLastMeasure && score.getRepeatSections().length === 0) {
        // final barline only on the very last measure of the whole score
        const allMeasures = score.getParts()[0]?.getVoices()[0]?.getMeasures() ?? []
        if (measureNumber === allMeasures.length) {
          stave.setEndBarType(Barline.type.END)
        }
      }

      stave.setContext(context).draw()

      if (isFirstVoice) firstVoiceStaves.push(stave)
      if (isLastVoice) lastVoiceStaves.push(stave)

      renderMeasureOnStave(context, measure, stave, measureNumber, opts, queues)

      xPos += w
    }

    // Part name label left of first stave
    if (opts.showPartNames && isFirstLine && voiceName) {
      const label =
        opts.partNameStyle === 'abbreviated' ? voiceName.charAt(0).toUpperCase() : voiceName
      context.save()
      context.setFont('serif', 14, 'bold')
      context.setFillStyle(theme.foreground)
      const labelWidth = context.measureText(label).width
      context.fillText(label, opts.padding - labelWidth - 6, line.y + 22)
      context.restore()
    }
  }

  // Spanners and grand staff connectors after all staves drawn
  context.setFillStyle(theme.foreground)
  context.setStrokeStyle(theme.foreground)
  drawSpanners(context, queues)

  if (
    opts.grandStaff &&
    voiceLayouts.length >= 2 &&
    firstVoiceStaves.length > 0 &&
    lastVoiceStaves.length > 0
  ) {
    for (let mi = 0; mi < firstVoiceStaves.length; mi++) {
      const top = firstVoiceStaves[mi]
      const bottom = lastVoiceStaves[mi]
      if (mi === 0) {
        new StaveConnector(top, bottom).setType('brace').setContext(context).draw()
        new StaveConnector(top, bottom).setType('singleLeft').setContext(context).draw()
      }
      new StaveConnector(top, bottom).setType('singleRight').setContext(context).draw()
    }
  }
}

// ─── Notes & beams ───────────────────────────────────────────────

function renderMeasureOnStave(
  context: RenderContext,
  measure: Measure,
  stave: Stave,
  _measureNumber: number,
  opts: Required<RenderOptions>,
  queues: SpannerQueues
): void {
  const renderNotes = groupNotesForRender(measure.getNotes())

  if (renderNotes.length === 0) return

  const staveNotes = createVexStaveNotes(renderNotes, opts)
  const renderToStave = buildRenderToStaveMap(renderNotes)

  const localSpanners = collectSpanners(renderNotes, staveNotes, renderToStave)
  queues.ties.push(...localSpanners.ties)
  queues.slurs.push(...localSpanners.slurs)
  queues.hairpins.push(...localSpanners.hairpins)
  queues.glissandos.push(...localSpanners.glissandos)

  const beatValue = durationToDenom(measure.timeSignature.noteValue ?? 'q')

  const vexVoice = new VexVoice({
    numBeats: measure.timeSignature.beats,
    beatValue: parseInt(beatValue),
  }).setMode(VoiceMode.SOFT)

  vexVoice.addTickables(staveNotes)
  // Format against stave width minus padding — exactly like the working experiment
  new Formatter().joinVoices([vexVoice]).format([vexVoice], stave.getWidth() - 40)
  vexVoice.draw(context, stave)

  drawBeams(context, staveNotes, renderNotes, renderToStave, [measure])
}

function drawBeams(
  context: RenderContext,
  staveNotes: StaveNote[],
  renderNotes: RenderNote[],
  renderToStave: number[],
  measures: readonly Measure[]
): void {
  const beatsPerMeasure = measures[0]?.timeSignature.beats ?? 4
  const beatBoundary = beatsPerMeasure > 3 ? 2 : beatsPerMeasure

  // Pre-compute absolute beat positions of each measure boundary so beams
  // never cross a barline.
  const measureBreaks = new Set<number>()
  let acc = 0
  for (const m of measures) {
    acc += m.totalBeats
    measureBreaks.add(acc)
  }

  // Groups contain stave-note indices (not render-note indices)
  const groups: number[][] = []
  let currentGroup: number[] = []
  let currentBeat = 0

  const flushGroup = () => {
    if (currentGroup.length >= 2) groups.push(currentGroup)
    currentGroup = []
  }

  for (let i = 0; i < renderNotes.length; i++) {
    const rn = renderNotes[i]
    const si = renderToStave[i]
    if (si < 0) continue // grace note — skip

    const baseDur = rn.duration.replace(/[dr]/g, '')
    const isBeamable = !rn.isRest && BEAMABLE_DURATIONS.has(baseDur)
    const noteBeats = rn.sourceNotes[0]?.beats ?? 0.5
    const nextBeat = currentBeat + noteBeats

    // Hard break at measure boundaries — never beam across a barline
    if (measureBreaks.has(currentBeat) && currentBeat > 0) {
      flushGroup()
    }

    const crossesBeatBoundary =
      Math.floor(currentBeat / beatBoundary) !== Math.floor((nextBeat - 0.001) / beatBoundary)

    if (isBeamable) {
      if (crossesBeatBoundary && currentGroup.length >= 2) {
        flushGroup()
        currentGroup = [si]
      } else if (crossesBeatBoundary) {
        currentGroup = [si]
      } else {
        currentGroup.push(si)
      }
    } else {
      flushGroup()
    }

    currentBeat = nextBeat
  }
  flushGroup()

  for (const group of groups) {
    const beamNotes = group.map((si) => staveNotes[si]).filter(Boolean)
    if (beamNotes.length < 2) continue
    try {
      new Beam(beamNotes).setContext(context).draw()
    } catch {
      // skip invalid beam — fresh context per system means no cross-stave corruption
    }
  }
}

// ─── Spanners ────────────────────────────────────────────────────

function drawSpanners(context: RenderContext, queues: SpannerQueues): void {
  for (const t of queues.ties) {
    new StaveTie({
      firstNote: t.firstNote,
      lastNote: t.lastNote,
      firstIndexes: [t.firstIndex],
      lastIndexes: [t.lastIndex],
    })
      .setContext(context)
      .draw()
  }

  for (const s of queues.slurs) {
    if (s.startNote && s.endNote) {
      new Curve(s.startNote, s.endNote ?? undefined, {}).setContext(context).draw()
    }
  }

  for (const g of queues.glissandos) {
    if (g.startNote && g.endNote) {
      new Curve(g.startNote, g.endNote, {
        cps: [
          { x: 0, y: 5 },
          { x: 0, y: 5 },
        ],
      })
        .setContext(context)
        .draw()
    }
  }

  for (const hp of queues.hairpins) {
    try {
      new StaveHairpin(
        { first_note: hp.firstNote, last_note: hp.lastNote },
        hp.type === 'cresc' ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC
      )
        .setContext(context)
        .draw()
    } catch {
      try {
        hp.firstNote.addModifier(new Annotation(hp.type === 'cresc' ? 'cresc.' : 'decresc.'), 0)
      } catch {
        // ignore
      }
    }
  }
}

// ─── Title ───────────────────────────────────────────────────────

function renderTitleInto(
  context: RenderContext,
  score: Score,
  opts: Required<RenderOptions>,
  _theme: ThemeColors
): void {
  if (score.title) {
    context.setFont('serif', 24, 'bold')
    const titleWidth = context.measureText(score.title).width
    context.fillText(score.title, (opts.width - titleWidth) / 2, opts.padding + 24)
  }
  if (score.composer) {
    context.setFont('serif', 14, 'italic')
    const composerWidth = context.measureText(score.composer).width
    context.fillText(score.composer, opts.width - opts.padding - composerWidth, opts.padding + 45)
  }
}

// ─── SVG export helpers ──────────────────────────────────────────

function wrapSVGParts(
  parts: Array<{ svg: string; height: number }>,
  width: number,
  totalHeight: number
): string {
  let yOffset = 0
  const inner = parts
    .map(({ svg, height }) => {
      // Strip outer <svg> wrapper — handle multi-line/multi-attribute opening tags
      const content = svg.replace(/<svg[\s\S]*?>/, '').replace(/<\/svg>\s*$/, '')
      const group = `<g transform="translate(0,${yOffset})">${content}</g>`
      yOffset += height
      return group
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}">\n${inner}\n</svg>`
}

// ─── Re-exports for backward compatibility ───────────────────────

export { groupNotesForRender, noteToVexKey, noteToVexDuration } from './render-note.js'
export { collectHairpinRuns } from './spanners.js'
export { DURATION_MAP } from './vex-maps.js'
export { releaseJsdom } from './jsdom-utils.js'
export type { RenderNote } from './render-note.js'
export type { HairpinRun } from './spanners.js'
