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

export function applyModifiers(
  staveNote: StaveNote,
  rn: RenderNote,
  opts: Required<RenderOptions>
): void {
  rn.accidentals.forEach((acc, idx) => {
    if (acc) staveNote.addModifier(new VexAccidental(acc), idx)
  })

  if (rn.dotted) Dot.buildAndAttach([staveNote])

  if (rn.dynamic && opts.showDynamics) {
    staveNote.addModifier(new Annotation(DYNAMIC_MAP[rn.dynamic] ?? rn.dynamic), 0)
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
  opts: Required<RenderOptions>
): StaveNote[] {
  const result: StaveNote[] = []
  let pendingGraceNotes: GraceNote[] = []

  for (const rn of renderNotes) {
    if (rn.graceNote) {
      pendingGraceNotes.push(new GraceNote({ keys: rn.keys, duration: '8', slash: true }))
      continue
    }

    const staveNote = new StaveNote({ keys: rn.keys, duration: rn.duration })

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
