import {
  StaveNote,
  Dot,
  Accidental as VexAccidental,
  Annotation,
  Articulation,
  Ornament as VexOrnament,
  GraceNote,
  GraceNoteGroup,
} from 'vexflow'

import type { RenderOptions } from './types.js'
import type { RenderNote } from './render-note.js'
import { DYNAMIC_MAP, ARTICULATION_MAP, ORNAMENT_MAP } from './vex-maps.js'

// Standard dynamics rendered in bold italic serif (music engraving style)
const GLYPH_DYNAMICS = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'])

/**
 * Apply manual accidentals to a stave note (used as fallback when
 * VexAccidental.applyAccidentals is unavailable or fails).
 */
export function applyManualAccidentals(staveNote: StaveNote, rn: RenderNote): void {
  rn.accidentals.forEach((acc, idx) => {
    if (acc) staveNote.addModifier(new VexAccidental(acc), idx)
  })
}

export function applyModifiers(
  staveNote: StaveNote,
  rn: RenderNote,
  opts: Required<RenderOptions>
): void {
  // Accidentals are NOT applied here — they are handled by
  // VexAccidental.applyAccidentals() in renderMeasureOnStave for
  // correct key-signature-aware display (no duplicates).

  if (rn.dotted) Dot.buildAndAttach([staveNote])

  if (rn.dynamic && opts.showDynamics) {
    const dynText = DYNAMIC_MAP[rn.dynamic] ?? rn.dynamic
    if (GLYPH_DYNAMICS.has(dynText)) {
      // Standard dynamics rendered in bold italic serif (music engraving style)
      staveNote.addModifier(
        new Annotation(dynText)
          .setFont('Times New Roman', 14, 'bold italic')
          .setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
        0
      )
    } else {
      // Fallback to plain text for cresc/decresc and unknown dynamics
      staveNote.addModifier(
        new Annotation(dynText)
          .setFont('Times New Roman', 11, 'italic')
          .setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
        0
      )
    }
  }

  if (rn.fermata) {
    staveNote.addModifier(new Articulation('a@a').setPosition(3), 0)
  }

  if (rn.articulation) {
    const code = ARTICULATION_MAP[rn.articulation]
    if (code) staveNote.addModifier(new Articulation(code), 0)
  }

  if (rn.ornament) {
    const code = ORNAMENT_MAP[rn.ornament]
    if (code) staveNote.addModifier(new VexOrnament(code).setPosition(3), 0)
  }

  if (rn.chordSymbol) {
    staveNote.addModifier(
      new Annotation(rn.chordSymbol)
        .setFont('Arial', 12, 'bold')
        .setVerticalJustification(Annotation.VerticalJustify.TOP),
      0
    )
  }

  if (rn.lyric) {
    staveNote.addModifier(
      new Annotation(rn.lyric).setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
      0
    )
  }

  if (rn.breath) {
    staveNote.addModifier(new Articulation('a,').setPosition(3), 0)
  }

  if (rn.expression) {
    staveNote.addModifier(
      new Annotation(rn.expression)
        .setFont('Times', 11, 'italic')
        .setVerticalJustification(Annotation.VerticalJustify.TOP),
      0
    )
  }
}

export function createVexStaveNotes(
  renderNotes: RenderNote[],
  clef: string,
  opts: Required<RenderOptions>
): StaveNote[] {
  const result: StaveNote[] = []
  let pendingGraceNotes: GraceNote[] = []
  const vexClef = clef === 'treble-8' ? 'treble' : clef
  // VexFlow note clef is always the base clef name (no annotation needed for notes)

  for (const rn of renderNotes) {
    if (rn.graceNote) {
      pendingGraceNotes.push(
        new GraceNote({ keys: rn.keys, duration: '8', slash: true, clef: vexClef })
      )
      continue
    }

    const isPercussionNote = rn.sourceNotes[0]?.isPercussion ?? false
    const staveNote = new StaveNote({
      keys: rn.keys,
      duration: rn.duration,
      clef: vexClef,
      ...(isPercussionNote ? { noteType: 'x' } : {}),
    })

    if (pendingGraceNotes.length > 0) {
      staveNote.addModifier(new GraceNoteGroup(pendingGraceNotes), 0)
      pendingGraceNotes = []
    }

    applyModifiers(staveNote, rn, opts)
    result.push(staveNote)
  }

  if (pendingGraceNotes.length > 0 && result.length > 0) {
    result[result.length - 1].addModifier(new GraceNoteGroup(pendingGraceNotes), 0)
  }

  return result
}
