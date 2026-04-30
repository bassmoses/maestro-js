import {
  Renderer,
  Stave,
  StaveNote,
  Voice as VexVoice,
  Formatter,
  Beam,
  StaveTie,
  Curve,
  type RenderContext,
  VoiceMode,
  Dot,
  Accidental as VexAccidental,
  Annotation,
  Articulation,
  Barline,
  StaveConnector,
} from 'vexflow'

import type { Score } from '../../model/Score.js'
import type { Note } from '../../model/Note.js'
import type { Measure } from '../../model/Measure.js'
import type { DurationName, Dynamic } from '../../model/types.js'
import { durationToDenom } from '../../model/Duration.js'
import type { RenderOptions, ThemeColors } from './types.js'
import { DEFAULT_RENDER_OPTIONS, THEMES } from './types.js'
import { buildScoreLayout, type VoiceLayout } from './StaveBuilder.js'

// Map Maestro duration names to VexFlow duration strings
const DURATION_MAP: Record<DurationName, string> = {
  w: 'w',
  h: 'h',
  q: 'q',
  e: '8',
  s: '16',
  t: '32',
}

// Map Maestro accidentals to VexFlow accidental strings
const ACCIDENTAL_MAP: Record<string, string> = {
  '#': '#',
  b: 'b',
  '##': '##',
  bb: 'bb',
}

// Map dynamic markings to VexFlow TextDynamics strings
const DYNAMIC_MAP: Record<Dynamic, string> = {
  ppp: 'ppp',
  pp: 'pp',
  p: 'p',
  mp: 'mp',
  mf: 'mf',
  f: 'f',
  ff: 'ff',
  fff: 'fff',
  cresc: 'cresc',
  decresc: 'decresc',
}

/**
 * Convert a Maestro Note to a VexFlow pitch key string.
 * VexFlow format: "C/4", "D#/5", "Bb/3", "B/4" (note/octave)
 */
function noteToVexKey(note: Note): string {
  if (note.isRest) {
    return `B/4` // rest position
  }
  const acc = note.accidental ?? ''
  return `${note.pitch}${acc}/${note.octave}`
}

/**
 * Convert a Maestro Note to a VexFlow duration string.
 * Handles dotted notes and rests.
 */
function noteToVexDuration(note: Note): string {
  let dur = DURATION_MAP[note.duration]
  if (note.dotted) dur += 'd'
  if (note.isRest) dur += 'r'
  return dur
}

/**
 * Group consecutive chord notes into a single VexFlow StaveNote with multiple keys.
 * Returns an array of "render items": each is either a single note or a chord group.
 */
interface RenderNote {
  keys: string[]
  duration: string
  accidentals: (string | null)[]
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  dotted: boolean
  isRest: boolean
  chordGroup?: number
  fermata: boolean
  lyric?: string
  sourceNotes: Note[]
}

function groupNotesForRender(notes: readonly Note[]): RenderNote[] {
  const result: RenderNote[] = []
  let currentChordGroup: number | undefined
  let currentChord: RenderNote | null = null

  for (const note of notes) {
    if (note.chord && note.chordGroup != null) {
      if (note.chordGroup === currentChordGroup && currentChord) {
        // Add key to existing chord
        currentChord.keys.push(noteToVexKey(note))
        currentChord.accidentals.push(
          note.accidental ? (ACCIDENTAL_MAP[note.accidental] ?? null) : null
        )
        currentChord.sourceNotes.push(note)
      } else {
        // Start new chord group
        if (currentChord) result.push(currentChord)
        currentChordGroup = note.chordGroup
        currentChord = {
          keys: [noteToVexKey(note)],
          duration: noteToVexDuration(note),
          accidentals: [note.accidental ? (ACCIDENTAL_MAP[note.accidental] ?? null) : null],
          dynamic: note.dynamic,
          tied: note.tied,
          slurred: note.slurred,
          dotted: note.dotted,
          isRest: false,
          chordGroup: note.chordGroup,
          fermata: note.fermata,
          lyric: note.lyric,
          sourceNotes: [note],
        }
      }
    } else {
      // Flush any pending chord
      if (currentChord) {
        result.push(currentChord)
        currentChord = null
        currentChordGroup = undefined
      }
      // Single note
      result.push({
        keys: [noteToVexKey(note)],
        duration: noteToVexDuration(note),
        accidentals: [note.accidental ? (ACCIDENTAL_MAP[note.accidental] ?? null) : null],
        dynamic: note.dynamic,
        tied: note.tied,
        slurred: note.slurred,
        dotted: note.dotted,
        isRest: note.isRest,
        fermata: note.fermata,
        lyric: note.lyric,
        sourceNotes: [note],
      })
    }
  }

  if (currentChord) result.push(currentChord)
  return result
}

export interface RenderedScore {
  svg: string
  width: number
  height: number
}

/**
 * Main VexFlow adapter — renders a Score model to SVG.
 * Works in both browser (DOM element target) and Node (SVG string export).
 */
export class VexFlowAdapter {
  /**
   * Render a score to an HTML element.
   */
  static render(score: Score, target: HTMLElement, options: RenderOptions = {}): void {
    const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
    const theme = THEMES[opts.theme]
    const { voiceLayouts, totalHeight } = buildScoreLayout(score, opts)

    // Create VexFlow renderer targeting the DOM element
    const renderer = new Renderer(target as HTMLDivElement, Renderer.Backends.SVG)
    renderer.resize(opts.width, totalHeight)
    const context = renderer.getContext()

    applyTheme(context, target, theme)
    renderTitle(context, score, opts, theme)
    renderAllVoices(context, score, voiceLayouts, opts, theme)
  }

  /**
   * Render a score to an SVG string (for Node.js or exportSVG).
   * In Node.js, uses jsdom to provide a DOM environment.
   */
  static renderToSVG(score: Score, options: RenderOptions = {}): RenderedScore {
    const opts = { ...DEFAULT_RENDER_OPTIONS, ...options }
    const theme = THEMES[opts.theme]
    const { voiceLayouts, totalHeight } = buildScoreLayout(score, opts)

    // If no native DOM, install jsdom globals for VexFlow
    const needsJsdom = typeof document === 'undefined'
    const cleanup = needsJsdom ? installJsdomGlobals() : null

    try {
      const container = createDetachedContainer()
      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(opts.width, totalHeight)
      const context = renderer.getContext()

      applyTheme(context, container, theme)
      renderTitle(context, score, opts, theme)
      renderAllVoices(context, score, voiceLayouts, opts, theme)

      const svg = extractSVG(container)
      return { svg, width: opts.width, height: totalHeight }
    } finally {
      cleanup?.()
    }
  }
}

// ─── Internal rendering functions ───────────────────────────────

function createDetachedContainer(): HTMLDivElement {
  if (typeof document !== 'undefined') {
    const div = document.createElement('div')
    div.style.position = 'absolute'
    div.style.left = '-9999px'
    document.body.appendChild(div)
    return div
  }
  // Fallback: try jsdom for Node.js
  return createJsdomContainer()
}

// Lazily cached jsdom document for Node.js rendering
let _jsdomDocument: Document | null = null
let _jsdomWindow: Window | null = null

/**
 * Release the cached JSDOM instance to free memory.
 * Call this in long-running server processes between render batches.
 */
export function releaseJsdom(): void {
  _jsdomDocument = null
  _jsdomWindow = null
}

function getJsdomDocument(): Document {
  if (_jsdomDocument) return _jsdomDocument
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom') as typeof import('jsdom')
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    _jsdomDocument = dom.window.document
    _jsdomWindow = dom.window as unknown as Window
    return _jsdomDocument
  } catch {
    throw new Error(
      'DOM not available. Install "jsdom" for server-side SVG rendering: npm install jsdom'
    )
  }
}

function createJsdomContainer(): HTMLDivElement {
  const doc = getJsdomDocument()
  const div = doc.createElement('div')
  doc.body.appendChild(div)
  return div as unknown as HTMLDivElement
}

/**
 * Set jsdom globals temporarily so VexFlow can find `document`.
 * Returns a cleanup function to restore previous state.
 */
function installJsdomGlobals(): () => void {
  const doc = getJsdomDocument()
  const prevDoc = (globalThis as Record<string, unknown>).document
  const prevWin = (globalThis as Record<string, unknown>).window
  ;(globalThis as Record<string, unknown>).document = doc
  if (_jsdomWindow) {
    ;(globalThis as Record<string, unknown>).window = _jsdomWindow
  }
  return () => {
    if (prevDoc === undefined) {
      delete (globalThis as Record<string, unknown>).document
    } else {
      ;(globalThis as Record<string, unknown>).document = prevDoc
    }
    if (prevWin === undefined) {
      delete (globalThis as Record<string, unknown>).window
    } else {
      ;(globalThis as Record<string, unknown>).window = prevWin
    }
  }
}

function extractSVG(container: HTMLElement): string {
  const svgEl = container.querySelector('svg')
  if (!svgEl) return ''
  const result = svgEl.outerHTML
  // Clean up
  if (container.parentNode) {
    container.parentNode.removeChild(container)
  }
  return result
}

function applyTheme(context: RenderContext, container: HTMLElement, theme: ThemeColors): void {
  container.style.backgroundColor = theme.background
  context.setFillStyle(theme.foreground)
  context.setStrokeStyle(theme.foreground)
}

function renderTitle(
  context: RenderContext,
  score: Score,
  opts: Required<RenderOptions>,
  theme: ThemeColors
): void {
  if (!score.title && !score.composer) return

  context.save()
  context.setFillStyle(theme.titleColor)

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

  context.restore()
}

function renderAllVoices(
  context: RenderContext,
  score: Score,
  voiceLayouts: VoiceLayout[],
  opts: Required<RenderOptions>,
  theme: ThemeColors
): void {
  const tieQueue: Array<{
    firstNote: StaveNote
    lastNote: StaveNote
    firstIndex: number
    lastIndex: number
    voiceIdx: number
  }> = []
  const slurQueue: Array<{
    startNote: StaveNote
    endNote: StaveNote | null
    lineIdx: number
    voiceIdx: number
  }> = []

  // Track staves for grand staff connectors: [lineIndex][voiceIndex] = Stave
  const stavesByLine: Map<number, Stave[]> = new Map()

  for (let vi = 0; vi < voiceLayouts.length; vi++) {
    const voiceLayout = voiceLayouts[vi]
    const { layout, clef } = voiceLayout

    for (let li = 0; li < layout.lines.length; li++) {
      const line = layout.lines[li]
      const isFirstLine = li === 0
      const staveX = opts.padding
      const staveWidth = layout.staveWidth

      // Create VexFlow Stave
      const stave = new Stave(staveX, line.y, staveWidth)

      if (isFirstLine) {
        stave.addClef(clef === 'treble-8' ? 'treble' : clef)
        stave.addTimeSignature(
          `${score.timeSignature.beats}/${durationToDenom(score.timeSignature.noteValue)}`
        )

        // Add tempo marking on first voice only
        if (vi === 0) {
          stave.setTempo({ duration: 'q', dots: 0, bpm: score.tempo }, 0)
        }
      }

      if (opts.showBarNumbers && line.measureStartIndex > 1) {
        stave.setText(`${line.measureStartIndex}`) // bar number at the top-left
      }

      // Add repeat barlines at stave line boundaries
      // VexFlow supports begin/end barline types per stave, so we apply them
      // only when the repeat boundary aligns with this stave line's start/end
      const repeats = score.getRepeatSections()
      const lineEndMeasure = line.measureStartIndex + line.measures.length - 1
      for (const rep of repeats) {
        if (rep.startMeasure === line.measureStartIndex) {
          stave.setBegBarType(Barline.type.REPEAT_BEGIN)
        }
        if (rep.endMeasure === lineEndMeasure) {
          stave.setEndBarType(Barline.type.REPEAT_END)
        }
      }

      stave.setContext(context).draw()

      // Track stave for grand staff connectors
      if (!stavesByLine.has(li)) stavesByLine.set(li, [])
      stavesByLine.get(li)!.push(stave)

      // Render notes for all measures on this line
      renderMeasuresOnStave(
        context,
        line.measures,
        stave,
        staveWidth,
        opts,
        theme,
        tieQueue,
        slurQueue,
        li,
        vi,
        line.measureStartIndex
      )
    }
  }

  // Draw ties — each entry is a pre-computed pair
  for (const tieEntry of tieQueue) {
    const tie = new StaveTie({
      firstNote: tieEntry.firstNote,
      lastNote: tieEntry.lastNote,
      firstIndexes: [tieEntry.firstIndex],
      lastIndexes: [tieEntry.lastIndex],
    })
    tie.setContext(context).draw()
  }

  // Draw slurs (curves)
  for (const sl of slurQueue) {
    if (sl.startNote && sl.endNote) {
      const curve = new Curve(sl.startNote, sl.endNote ?? undefined, {})
      curve.setContext(context).draw()
    }
  }

  // Draw grand staff connectors
  if (opts.grandStaff && voiceLayouts.length >= 2) {
    for (const [, staves] of stavesByLine) {
      if (staves.length >= 2) {
        const topStave = staves[0]
        const bottomStave = staves[staves.length - 1]
        const brace = new StaveConnector(topStave, bottomStave)
        brace.setType('brace')
        brace.setContext(context).draw()
        const line = new StaveConnector(topStave, bottomStave)
        line.setType('singleLeft')
        line.setContext(context).draw()
      }
    }
  }
}

function renderMeasuresOnStave(
  context: RenderContext,
  measures: readonly Measure[],
  stave: Stave,
  staveWidth: number,
  opts: Required<RenderOptions>,
  theme: ThemeColors,
  tieQueue: Array<{
    firstNote: StaveNote
    lastNote: StaveNote
    firstIndex: number
    lastIndex: number
    voiceIdx: number
  }>,
  slurQueue: Array<{
    startNote: StaveNote
    endNote: StaveNote | null
    lineIdx: number
    voiceIdx: number
  }>,
  lineIdx: number,
  voiceIdx: number,
  _measureStartIndex: number
): void {
  // Collect all notes across measures for this stave line
  const allRenderNotes: RenderNote[] = []
  for (const measure of measures) {
    const grouped = groupNotesForRender(measure.getNotes())
    allRenderNotes.push(...grouped)
  }

  if (allRenderNotes.length === 0) return

  // Create StaveNotes
  const staveNotes = createVexStaveNotes(allRenderNotes, theme, opts)

  // Track ties and slurs
  let inSlur = false
  let slurStartNote: StaveNote | null = null

  for (let i = 0; i < allRenderNotes.length; i++) {
    const rn = allRenderNotes[i]

    if (rn.tied) {
      // Tie connects this note to the next note in the stave
      if (i + 1 < staveNotes.length) {
        tieQueue.push({
          firstNote: staveNotes[i],
          lastNote: staveNotes[i + 1],
          firstIndex: 0,
          lastIndex: 0,
          voiceIdx,
        })
      }
    }

    if (rn.slurred) {
      if (!inSlur) {
        inSlur = true
        slurStartNote = staveNotes[i]
      }
    } else if (inSlur) {
      inSlur = false
      slurQueue.push({
        startNote: slurStartNote!,
        endNote: staveNotes[i - 1] ?? null,
        lineIdx,
        voiceIdx,
      })
      slurStartNote = null
    }
  }

  // Close any unclosed slur at end of line
  if (inSlur && slurStartNote) {
    slurQueue.push({
      startNote: slurStartNote,
      endNote: staveNotes[staveNotes.length - 1],
      lineIdx,
      voiceIdx,
    })
  }

  // Create VexFlow Voice and add notes
  const totalBeats = measures.reduce((sum, m) => sum + m.totalBeats, 0)
  const beatValue = durationToDenom(measures[0]?.timeSignature.noteValue ?? 'q')

  const vexVoice = new VexVoice({
    numBeats: totalBeats,
    beatValue: parseInt(beatValue),
  }).setMode(VoiceMode.SOFT)

  vexVoice.addTickables(staveNotes)

  // Format and draw
  new Formatter().joinVoices([vexVoice]).format([vexVoice], staveWidth - 60)
  vexVoice.draw(context, stave)

  // Auto-beam
  drawBeams(context, staveNotes, allRenderNotes, measures)
}

function createVexStaveNotes(
  renderNotes: RenderNote[],
  theme: ThemeColors,
  opts: Required<RenderOptions>
): StaveNote[] {
  return renderNotes.map((rn) => {
    const staveNote = new StaveNote({
      keys: rn.keys,
      duration: rn.duration,
    })

    // Add accidentals per key
    rn.accidentals.forEach((acc, idx) => {
      if (acc) {
        staveNote.addModifier(new VexAccidental(acc), idx)
      }
    })

    // Add dots
    if (rn.dotted) {
      Dot.buildAndAttach([staveNote])
    }

    // Add dynamic text below note
    if (rn.dynamic && opts.showDynamics) {
      const dynText = new Annotation(DYNAMIC_MAP[rn.dynamic] ?? rn.dynamic)
      staveNote.addModifier(dynText, 0)
    }

    // Add fermata articulation above note
    if (rn.fermata) {
      staveNote.addModifier(new Articulation('a@a').setPosition(3), 0)
    }

    // Add lyric text below note
    if (rn.lyric) {
      const lyricAnnotation = new Annotation(rn.lyric).setVerticalJustification(
        Annotation.VerticalJustify.BOTTOM
      )
      staveNote.addModifier(lyricAnnotation, 0)
    }

    return staveNote
  })
}

function drawBeams(
  context: RenderContext,
  staveNotes: StaveNote[],
  renderNotes: RenderNote[],
  measures: readonly Measure[]
): void {
  const beatsPerMeasure = measures[0]?.timeSignature.beats ?? 4
  // Group beamable notes respecting beat boundaries
  const beatBoundary = beatsPerMeasure > 3 ? 2 : beatsPerMeasure

  const groups: number[][] = []
  let currentGroup: number[] = []
  let currentBeat = 0

  for (let i = 0; i < renderNotes.length; i++) {
    const rn = renderNotes[i]
    const baseDur = rn.duration.replace(/[dr]/g, '')
    const isBeamable = !rn.isRest && ['8', '16', '32'].includes(baseDur)
    const noteBeats = rn.sourceNotes[0]?.beats ?? 0.5

    // Check if this note crosses a beat boundary
    const nextBeat = currentBeat + noteBeats
    const crossesBoundary =
      Math.floor(currentBeat / beatBoundary) !== Math.floor((nextBeat - 0.001) / beatBoundary)

    if (isBeamable) {
      if (crossesBoundary && currentGroup.length >= 2) {
        // Close group at boundary, then start new one with this note
        groups.push(currentGroup)
        currentGroup = [i]
      } else if (crossesBoundary && currentGroup.length < 2) {
        // Not enough notes for a beam, start fresh
        currentGroup = [i]
      } else {
        currentGroup.push(i)
      }
    } else {
      // Non-beamable breaks the group
      if (currentGroup.length >= 2) groups.push(currentGroup)
      currentGroup = []
    }

    currentBeat = nextBeat
  }
  if (currentGroup.length >= 2) groups.push(currentGroup)

  // Create beams
  for (const group of groups) {
    const beamNotes = group.map((i) => staveNotes[i])
    try {
      const beam = new Beam(beamNotes)
      beam.setContext(context).draw()
    } catch {
      // VexFlow may reject some beam configurations — skip silently
    }
  }
}

// Re-export for use in tests
export { groupNotesForRender, noteToVexKey, noteToVexDuration, DURATION_MAP }
export type { RenderNote }
