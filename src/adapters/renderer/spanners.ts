import type { StaveNote } from 'vexflow'
import type { RenderNote } from './render-note.js'

// ─── Types ──────────────────────────────────────────────────────

export interface TieEntry {
  firstNote: StaveNote
  lastNote: StaveNote
  firstIndex: number
  lastIndex: number
}

export interface SlurEntry {
  startNote: StaveNote
  endNote: StaveNote | null
}

export interface HairpinEntry {
  firstNote: StaveNote
  lastNote: StaveNote
  type: 'cresc' | 'decresc'
}

export interface GlissandoEntry {
  startNote: StaveNote
  endNote: StaveNote | null
}

export interface SpannerQueues {
  ties: TieEntry[]
  slurs: SlurEntry[]
  hairpins: HairpinEntry[]
  glissandos: GlissandoEntry[]
}

export interface HairpinRun {
  startIdx: number
  endIdx: number
  type: 'cresc' | 'decresc'
}

// ─── Index Mapping ──────────────────────────────────────────────

export function buildRenderToStaveMap(renderNotes: RenderNote[]): number[] {
  const map: number[] = []
  let staveIdx = 0
  for (const rn of renderNotes) {
    map.push(rn.graceNote ? -1 : staveIdx++)
  }
  return map
}

export function findNextStaveIndex(renderToStave: number[], start: number): number {
  for (let j = start + 1; j < renderToStave.length; j++) {
    if (renderToStave[j] >= 0) return renderToStave[j]
  }
  return -1
}

export function findPrevStaveIndex(renderToStave: number[], start: number): number {
  for (let j = start - 1; j >= 0; j--) {
    if (renderToStave[j] >= 0) return renderToStave[j]
  }
  return -1
}

// ─── Hairpin Detection ──────────────────────────────────────────

export function collectHairpinRuns(renderNotes: RenderNote[]): HairpinRun[] {
  const runs: HairpinRun[] = []
  let runType: 'cresc' | 'decresc' | null = null
  let runStart = -1

  for (let i = 0; i < renderNotes.length; i++) {
    const dyn = renderNotes[i].dynamic
    const isHairpin = dyn === 'cresc' || dyn === 'decresc'

    if (isHairpin) {
      if (runType === null) {
        runType = dyn as 'cresc' | 'decresc'
        runStart = i
      } else if (dyn !== runType) {
        runs.push({ startIdx: runStart, endIdx: i - 1, type: runType })
        runType = dyn as 'cresc' | 'decresc'
        runStart = i
      }
    } else if (runType !== null) {
      runs.push({ startIdx: runStart, endIdx: i - 1, type: runType })
      runType = null
      runStart = -1
    }
  }

  if (runType !== null) {
    runs.push({ startIdx: runStart, endIdx: renderNotes.length - 1, type: runType })
  }

  return runs
}

// ─── Spanner Collection ─────────────────────────────────────────

export function collectSpanners(
  renderNotes: RenderNote[],
  staveNotes: StaveNote[],
  renderToStave: number[]
): SpannerQueues {
  const ties: TieEntry[] = []
  const slurs: SlurEntry[] = []
  const hairpins: HairpinEntry[] = []
  const glissandos: GlissandoEntry[] = []

  let inSlur = false
  let slurStartNote: StaveNote | null = null

  for (let i = 0; i < renderNotes.length; i++) {
    const rn = renderNotes[i]
    const si = renderToStave[i]
    if (si < 0) continue

    if (rn.tied) {
      const nextSi = findNextStaveIndex(renderToStave, i)
      if (nextSi >= 0 && nextSi < staveNotes.length) {
        ties.push({
          firstNote: staveNotes[si],
          lastNote: staveNotes[nextSi],
          firstIndex: 0,
          lastIndex: 0,
        })
      }
    }

    if (rn.slurred) {
      if (!inSlur) {
        inSlur = true
        slurStartNote = staveNotes[si]
      }
    } else if (inSlur) {
      inSlur = false
      const prevSi = findPrevStaveIndex(renderToStave, i)
      if (prevSi >= 0) {
        slurs.push({ startNote: slurStartNote!, endNote: staveNotes[prevSi] })
      }
      slurStartNote = null
    }

    if (rn.glissando) {
      const nextSi = findNextStaveIndex(renderToStave, i)
      if (nextSi >= 0 && nextSi < staveNotes.length) {
        glissandos.push({ startNote: staveNotes[si], endNote: staveNotes[nextSi] })
      }
    }
  }

  if (inSlur && slurStartNote) {
    slurs.push({ startNote: slurStartNote, endNote: staveNotes[staveNotes.length - 1] })
  }

  const nonGraceNotes = renderNotes.filter((rn) => !rn.graceNote)
  for (const run of collectHairpinRuns(nonGraceNotes)) {
    hairpins.push({
      firstNote: staveNotes[run.startIdx],
      lastNote: staveNotes[run.endIdx],
      type: run.type,
    })
  }

  return { ties, slurs, hairpins, glissandos }
}
