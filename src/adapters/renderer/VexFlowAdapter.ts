import {
  Renderer,
  Stave,
  StaveNote,
  Voice as VexVoice,
  Formatter,
  Beam,
  Tuplet,
  StaveTie,
  Curve,
  StaveHairpin,
  type RenderContext,
  VoiceMode,
  Annotation,
  Barline,
  StaveConnector,
  Repetition,
  VoltaType,
  Accidental as VexAccidental,
  MultiMeasureRest,
  TabStave,
  TabNote,
} from 'vexflow'

import { midiToTabPositions, TUNINGS } from './TabRenderer.js'

import type { Score } from '../../model/Score.js'
import type { Measure } from '../../model/Measure.js'
import type { Note } from '../../model/Note.js'
import { durationToDenom } from '../../model/Duration.js'
import type { RenderOptions, ThemeColors, NotePositionMap } from './types.js'
import { DEFAULT_RENDER_OPTIONS, THEMES } from './types.js'
import { buildScoreLayout, type VoiceLayout } from './StaveBuilder.js'
import { BEAMABLE_DURATIONS } from './vex-maps.js'
import { groupNotesForRender, type RenderNote } from './render-note.js'
import { collectSpanners, buildRenderToStaveMap, type SpannerQueues } from './spanners.js'
import { createVexStaveNotes, applyManualAccidentals } from './modifiers.js'
import { installJsdomGlobals, createDetachedContainer, extractSVG } from './jsdom-utils.js'

// Number of accidentals per key — used to compute extra stave width for key signature
const KEY_ACCIDENTAL_COUNT: Record<string, number> = {
  C: 0,
  Am: 0,
  G: 1,
  Em: 1,
  D: 2,
  Bm: 2,
  A: 3,
  'F#m': 3,
  E: 4,
  'C#m': 4,
  B: 5,
  'G#m': 5,
  'F#': 6,
  'D#m': 6,
  'C#': 7,
  'A#m': 7,
  F: 1,
  Dm: 1,
  Bb: 2,
  Gm: 2,
  Eb: 3,
  Cm: 3,
  Ab: 4,
  Fm: 4,
  Db: 5,
  Bbm: 5,
  Gb: 6,
  Ebm: 6,
  Cb: 7,
  Abm: 7,
}

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
  static render(score: Score, target: HTMLElement, options: RenderOptions = {}): NotePositionMap {
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

    if (opts.ariaLabel) {
      const label = score.title ? `Sheet music: ${score.title}` : 'Sheet music'
      target.setAttribute('role', 'img')
      target.setAttribute('aria-label', label)
    }

    return new Map() // position map populated by browser rendering
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

  // Precompute score-level lookups (avoid repeated work inside the measure loop)
  const voltaMap = new Map<number, number>()
  for (const v of score.getVoltaEndings()) voltaMap.set(v.measure, v.ending)

  const repeatSections = score.getRepeatSections()
  const segnoMeasure = score.getSegnoMeasure()
  const codaMeasure = score.getCodaMeasure()
  const fineMeasure = score.getFineMeasure()
  const hasDaCapo = score.getDaCapo()
  const hasDalSegno = score.getDalSegno()
  const totalMeasureCount = score.getParts()[0]?.getVoices()[0]?.getMeasures().length ?? 0
  const hasRepeats = repeatSections.length > 0
  const hasKey = score.key && score.key !== 'C' && score.key !== 'Am'
  const vexClefName = (clef: string) => {
    if (clef === 'treble-8') return 'treble'
    return clef // 'percussion', 'bass', 'alto', 'tenor', 'treble' pass through unchanged
  }
  const vexClefAnnotation = (clef: string) => (clef === 'treble-8' ? '8vb' : undefined)

  let noteIndexOffset = 0

  for (let vi = 0; vi < voiceLayouts.length; vi++) {
    const { layout, clef, voiceName } = voiceLayouts[vi]
    if (li >= layout.lines.length) continue

    // Tab voices are rendered in the second pass (TabStave); skip standard stave rendering
    if (clef === 'tab') continue

    const line = layout.lines[li]
    if (line.measures.length === 0) continue

    const isFirstLine = li === 0
    const isFirstVoice = vi === 0
    const isLastVoice = vi === voiceLayouts.length - 1

    // Extra width for clef + key sig on first measure of each line, plus time sig on first line
    const keyAccidentals = KEY_ACCIDENTAL_COUNT[score.key] ?? 0
    const firstMeasureExtra = 60 + keyAccidentals * 12 + (isFirstLine ? 20 : 0)
    const totalStaveWidth = opts.width - opts.padding * 2
    const measureWidth = (totalStaveWidth - firstMeasureExtra) / line.measures.length

    let xPos = opts.padding

    for (let mi = 0; mi < line.measures.length; mi++) {
      const measure = line.measures[mi]
      const isFirstMeasure = mi === 0
      const isLastMeasure = mi === line.measures.length - 1
      const w = isFirstMeasure ? measureWidth + firstMeasureExtra : measureWidth
      const measureNumber = line.measureStartIndex + mi

      // Pickup measure: narrow width proportional to beats used, minimum 80px
      const staveWidth =
        isFirstMeasure && measure.isPickup ? Math.max(80, Math.round(measure.totalBeats * 50)) : w
      const stave = new Stave(xPos, line.y, staveWidth)

      // Pickup measure: hide the opening (left) barline
      if (isFirstMeasure && measure.isPickup) {
        stave.setBegBarType(Barline.type.NONE)
      }

      // Clef + key signature on the first measure of every system line
      if (isFirstMeasure) {
        stave.addClef(vexClefName(clef), 'default', vexClefAnnotation(clef))
        if (hasKey) stave.addKeySignature(score.key)
        // Time signature and tempo only on the very first line
        if (isFirstLine) {
          stave.addTimeSignature(
            `${score.timeSignature.beats}/${durationToDenom(score.timeSignature.noteValue)}`
          )
          if (isFirstVoice) {
            stave.setTempo({ duration: 'q', dots: 0, bpm: score.tempo }, 0)
          }
        }
      }

      if (opts.showBarNumbers && measureNumber > 1 && isFirstMeasure) {
        stave.setText(`${measureNumber}`)
      }

      // Rehearsal marks
      if (measure.rehearsalMark) {
        stave.setSection(measure.rehearsalMark, 0)
      }

      // Volta brackets (1st/2nd endings)
      const voltaEnding = voltaMap.get(measureNumber)
      if (voltaEnding !== undefined) {
        stave.setVoltaType(VoltaType.BEGIN, `${voltaEnding}.`, 0)
      }

      // Repetition symbols (D.C., D.S., Segno, Coda, Fine)
      if (segnoMeasure === measureNumber) {
        stave.addModifier(new Repetition(Repetition.type.SEGNO_LEFT, 0, 0))
      }
      if (codaMeasure === measureNumber) {
        stave.addModifier(new Repetition(Repetition.type.CODA_LEFT, 0, 0))
      }
      if (fineMeasure === measureNumber) {
        stave.addModifier(new Repetition(Repetition.type.FINE, 0, 0))
      }
      if (measureNumber === totalMeasureCount) {
        if (hasDaCapo) stave.addModifier(new Repetition(Repetition.type.DC, 0, 0))
        if (hasDalSegno) stave.addModifier(new Repetition(Repetition.type.DS, 0, 0))
      }

      for (const rep of repeatSections) {
        if (rep.startMeasure === measureNumber) stave.setBegBarType(Barline.type.REPEAT_BEGIN)
        if (rep.endMeasure === measureNumber) stave.setEndBarType(Barline.type.REPEAT_END)
      }

      if (isLastMeasure && !hasRepeats && measureNumber === totalMeasureCount) {
        stave.setEndBarType(Barline.type.END)
      }

      stave.setContext(context).draw()

      if (isFirstVoice) firstVoiceStaves.push(stave)
      if (isLastVoice) lastVoiceStaves.push(stave)

      renderMeasureOnStave(
        context,
        measure,
        stave,
        measureNumber,
        clef,
        opts,
        queues,
        score.key,
        noteIndexOffset
      )
      // Advance offset by the number of non-grace render notes in this measure
      noteIndexOffset += groupNotesForRender(measure.getNotes()).filter(
        (rn) => !rn.graceNote
      ).length

      xPos += staveWidth
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

  // Second pass: render TabStave for voices with clef === 'tab'
  for (let vi = 0; vi < voiceLayouts.length; vi++) {
    const { layout, clef } = voiceLayouts[vi]
    if (clef !== 'tab') continue
    if (li >= layout.lines.length) continue

    const line = layout.lines[li]
    if (line.measures.length === 0) continue

    const keyAccidentals = KEY_ACCIDENTAL_COUNT[score.key] ?? 0
    const firstMeasureExtra = 60 + keyAccidentals * 12 + (li === 0 ? 20 : 0)
    const totalStaveWidth = opts.width - opts.padding * 2
    const measureWidth = (totalStaveWidth - firstMeasureExtra) / line.measures.length

    // Tab stave is rendered 80px below the standard system
    const tabY = line.y + 80
    let xPos = opts.padding

    for (let mi = 0; mi < line.measures.length; mi++) {
      const measure = line.measures[mi]
      const isFirstMeasure = mi === 0
      const w = isFirstMeasure ? measureWidth + firstMeasureExtra : measureWidth
      const staveWidth =
        isFirstMeasure && measure.isPickup ? Math.max(80, Math.round(measure.totalBeats * 50)) : w

      const tabStave = new TabStave(xPos, tabY, staveWidth)
      if (isFirstMeasure) tabStave.addClef('tab')
      tabStave.setContext(context).draw()

      const rawNotes = measure.getNotes().filter((n) => !n.isRest)
      const tuning = TUNINGS.guitar

      const tabNotes = rawNotes.map((note) => {
        const midi = note.isPercussion ? (note.percussionMidi ?? 60) : (note.midi ?? 60)
        const positions = midiToTabPositions([midi], tuning)
        return new TabNote({ positions, duration: note.duration })
      })

      if (tabNotes.length > 0) {
        try {
          const tabVoice = new VexVoice({
            numBeats: measure.timeSignature.beats,
            beatValue: parseInt(durationToDenom(measure.timeSignature.noteValue ?? 'q')),
          }).setMode(VoiceMode.SOFT)
          tabVoice.addTickables(tabNotes)
          new Formatter().joinVoices([tabVoice]).format([tabVoice], staveWidth - 40)
          tabVoice.draw(context, tabStave)
        } catch {
          // Skip malformed tab measure without crashing the render
        }
      }

      xPos += staveWidth
    }
  }
}

// ─── Notes & beams ───────────────────────────────────────────────

function buildNoteAriaLabel(note: Note, measureIndex: number): string {
  const DURATION_NAMES: Record<string, string> = {
    w: 'whole',
    h: 'half',
    q: 'quarter',
    e: 'eighth',
    s: 'sixteenth',
    t: 'thirty-second',
  }
  const pitch = note.pitch === 'R' ? 'rest' : `${note.pitch}${note.octave}`
  const durName = DURATION_NAMES[note.duration] ?? note.duration
  const dotted = note.dotted ? 'dotted ' : ''
  return `${pitch}, ${dotted}${durName} note, measure ${measureIndex + 1}`
}

function renderMeasureOnStave(
  context: RenderContext,
  measure: Measure,
  stave: Stave,
  measureNumber: number,
  clef: string,
  opts: Required<RenderOptions>,
  queues: SpannerQueues,
  keySignature: string,
  noteIndexOffset: number = 0
): void {
  // Multi-measure rest: single note with multiMeasureRest > 0 — render compact symbol, skip normal layout
  const rawNotes = measure.getNotes()
  if (
    rawNotes.length === 1 &&
    rawNotes[0].multiMeasureRest != null &&
    rawNotes[0].multiMeasureRest > 0
  ) {
    const mmr = new MultiMeasureRest(rawNotes[0].multiMeasureRest, {
      numberOfMeasures: rawNotes[0].multiMeasureRest,
      showNumber: true,
    })
    mmr.setStave(stave).setContext(context).draw()
    return
  }

  const renderNotes = groupNotesForRender(rawNotes)

  if (renderNotes.length === 0) return

  const staveNotes = createVexStaveNotes(renderNotes, clef, opts)
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

  // Auto-apply accidentals based on key signature (handles courtesy accidentals,
  // naturals, and omits accidentals already in the key)
  try {
    VexAccidental.applyAccidentals([vexVoice], keySignature)
  } catch {
    // Fallback: manually attach accidentals from the parsed note data
    for (let i = 0; i < renderNotes.length; i++) {
      const si = renderToStave[i]
      if (si >= 0) applyManualAccidentals(staveNotes[si], renderNotes[i])
    }
  }

  // Format against stave width minus padding — exactly like the working experiment
  new Formatter().joinVoices([vexVoice]).format([vexVoice], stave.getWidth() - 40)
  vexVoice.draw(context, stave)

  // Per-note accessibility tagging — runs after VexFlow has drawn to the DOM
  staveNotes.forEach((sn, localIdx) => {
    try {
      const el = (sn as { getSVGElement?: () => Element | null }).getSVGElement?.() ?? null
      if (!el) return
      const globalIdx = noteIndexOffset + localIdx
      el.setAttribute('data-note-index', String(globalIdx))
      el.setAttribute('data-measure-index', String(measureNumber - 1))
      if (opts.ariaLabel) {
        const src = renderNotes[localIdx]?.sourceNotes[0]
        if (src) {
          el.setAttribute('aria-label', buildNoteAriaLabel(src, measureNumber - 1))
        }
      }
    } catch {
      // SVG element unavailable (e.g. jsdom tests) — skip silently
    }
  })

  drawBeams(context, staveNotes, renderNotes, renderToStave, [measure])
  drawTuplets(context, staveNotes, renderNotes, renderToStave)
}

function drawBeams(
  context: RenderContext,
  staveNotes: StaveNote[],
  renderNotes: RenderNote[],
  renderToStave: number[],
  measures: readonly Measure[]
): void {
  const ts = measures[0]?.timeSignature
  const beatsPerMeasure = ts?.beats ?? 4
  const noteValue = ts?.noteValue ?? 'q'
  // Compound meters (6/8, 9/8, 12/8): beam in groups of 3 eighth notes (dotted quarter = 1.5 beats)
  // Simple meters: beam per half-measure (2 beats) or per measure if <= 3 beats
  const isCompound = noteValue === 'e' && beatsPerMeasure % 3 === 0
  const beatBoundary = isCompound ? 1.5 : beatsPerMeasure > 3 ? 2 : beatsPerMeasure

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

function drawTuplets(
  context: RenderContext,
  staveNotes: StaveNote[],
  renderNotes: RenderNote[],
  renderToStave: number[]
): void {
  // Collect consecutive triplet/tuplet notes into groups, then wrap each group in a Tuplet
  let group: StaveNote[] = []
  let currentRatio: { num: number; den: number } | undefined

  const flush = () => {
    if (group.length >= 2) {
      try {
        const tupletOpts: { numNotes?: number; notesOccupied?: number } = {}
        if (currentRatio) {
          tupletOpts.numNotes = currentRatio.num
          tupletOpts.notesOccupied = currentRatio.den
        }
        new Tuplet(group, tupletOpts).setContext(context).draw()
      } catch {
        // ignore — invalid tuplet (e.g. incomplete group)
      }
    }
    group = []
    currentRatio = undefined
  }

  for (let i = 0; i < renderNotes.length; i++) {
    const rn = renderNotes[i]
    const si = renderToStave[i]
    if (si < 0) continue
    const note = rn.sourceNotes[0]
    if (note?.triplet || note?.tupletRatio) {
      const ratio = rn.tupletRatio ?? note?.tupletRatio
      // Start new group if ratio changes
      if (
        currentRatio &&
        ratio &&
        (currentRatio.num !== ratio.num || currentRatio.den !== ratio.den)
      ) {
        flush()
      }
      if (!currentRatio && ratio) currentRatio = ratio
      group.push(staveNotes[si])
    } else {
      flush()
    }
  }
  flush()
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
          { x: 0, y: 15 },
          { x: 0, y: 15 },
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
