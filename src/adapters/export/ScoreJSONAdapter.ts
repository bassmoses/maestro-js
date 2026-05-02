import { Score } from '../../model/Score.js'
import { Note } from '../../model/Note.js'
import type {
  NoteData,
  PitchName,
  Accidental,
  Octave,
  DurationName,
  Dynamic,
  Articulation,
  Ornament,
} from '../../model/types.js'
import { durationToDenom } from '../../model/Duration.js'
import type { Clef } from '../../model/VoiceModel.js'

/**
 * ScoreJSON — a portable JSON format for storing and exchanging scores.
 *
 * This format is designed for persistence (e.g. Supabase, localStorage)
 * and interoperability. It captures the full score structure including
 * parts, voices, measures, notes, tempo changes, repeats, and metadata.
 */

// ─── ScoreJSON Types ────────────────────────────────────────────

export interface ScoreJSON {
  version: 1
  metadata: ScoreJSONMetadata
  settings: ScoreJSONSettings
  parts: ScoreJSONPart[]
  tempoChanges?: ScoreJSONTempoChange[]
  repeats?: ScoreJSONRepeat[]
  daCapo?: boolean
  dalSegno?: boolean
  segnoMeasure?: number
  codaMeasure?: number
  fineMeasure?: number
  voltaEndings?: Array<{ measure: number; ending: number }>
}

export interface ScoreJSONMetadata {
  title?: string
  composer?: string
}

export interface ScoreJSONSettings {
  tempo: number
  timeSignature: string
  key: string
}

export interface ScoreJSONPart {
  name: string
  voices: ScoreJSONVoice[]
}

export interface ScoreJSONVoice {
  name: string
  clef: Clef
  measures: ScoreJSONMeasure[]
}

export interface ScoreJSONMeasure {
  notes: ScoreJSONNote[]
  rehearsalMark?: string
}

export interface ScoreJSONNote {
  pitch: string // 'C', 'D', ..., 'R' for rest
  accidental?: string | null
  octave: number
  duration: string // 'w', 'h', 'q', 'e', 's', 't'
  dotted?: boolean
  dynamic?: string | null
  tied?: boolean
  slurred?: boolean
  chord?: boolean
  chordGroup?: number
  fermata?: boolean
  breath?: boolean
  triplet?: boolean
  tupletRatio?: { num: number; den: number }
  lyric?: string
  articulation?: Articulation
  ornament?: string
  graceNote?: boolean
  chordSymbol?: string
  glissando?: boolean
  expression?: string
}

export interface ScoreJSONTempoChange {
  measure: number
  bpm: number
}

export interface ScoreJSONRepeat {
  startMeasure: number
  endMeasure: number
}

// ─── Adapter ────────────────────────────────────────────────────

export class ScoreJSONAdapter {
  /**
   * Export a Score model to ScoreJSON format.
   */
  static toJSON(score: Score): ScoreJSON {
    const parts: ScoreJSONPart[] = []

    for (const part of score.getParts()) {
      const voices: ScoreJSONVoice[] = []

      for (const voice of part.getVoices()) {
        const measures: ScoreJSONMeasure[] = []

        for (const measure of voice.getMeasures()) {
          const notes: ScoreJSONNote[] = []

          for (const note of measure.getNotes()) {
            notes.push(noteToJSON(note))
          }

          const measureJSON: ScoreJSONMeasure = { notes }
          if (measure.rehearsalMark) measureJSON.rehearsalMark = measure.rehearsalMark
          measures.push(measureJSON)
        }

        voices.push({
          name: voice.name,
          clef: voice.clef,
          measures,
        })
      }

      parts.push({ name: part.name, voices })
    }

    const result: ScoreJSON = {
      version: 1,
      metadata: {
        title: score.title || undefined,
        composer: score.composer || undefined,
      },
      settings: {
        tempo: score.tempo,
        timeSignature: `${score.timeSignature.beats}/${durationToDenom(score.timeSignature.noteValue)}`,
        key: score.key,
      },
      parts,
    }

    // Tempo changes
    const tempoMap = score.getTempoMap()
    if (tempoMap.size > 0) {
      result.tempoChanges = Array.from(tempoMap.entries()).map(([measure, bpm]) => ({
        measure,
        bpm,
      }))
    }

    // Repeats
    const repeats = score.getRepeatSections()
    if (repeats.length > 0) {
      result.repeats = repeats.map((r) => ({
        startMeasure: r.startMeasure,
        endMeasure: r.endMeasure,
      }))
    }

    // Da Capo
    if (score.getDaCapo()) {
      result.daCapo = true
    }

    // Dal Segno / navigation markers
    if (score.getDalSegno()) {
      result.dalSegno = true
    }
    const segno = score.getSegnoMeasure()
    if (segno != null) result.segnoMeasure = segno
    const coda = score.getCodaMeasure()
    if (coda != null) result.codaMeasure = coda
    const fine = score.getFineMeasure()
    if (fine != null) result.fineMeasure = fine
    const voltas = score.getVoltaEndings()
    if (voltas.length > 0) {
      result.voltaEndings = voltas.map((v) => ({ measure: v.measure, ending: v.ending }))
    }

    return result
  }

  /**
   * Import a ScoreJSON object into a Score model.
   */
  static fromJSON(json: ScoreJSON): Score {
    if (json.version !== 1) {
      throw new Error(`Unsupported ScoreJSON version: ${json.version}`)
    }

    const score = new Score({
      tempo: json.settings.tempo,
      timeSignature: json.settings.timeSignature,
      key: json.settings.key,
      title: json.metadata?.title,
      composer: json.metadata?.composer,
    })

    // Rebuild parts and voices
    for (const partJSON of json.parts) {
      const part = score.addPart(partJSON.name)

      for (const voiceJSON of partJSON.voices) {
        const voice = part.addVoice(voiceJSON.name, voiceJSON.clef)

        for (const measureJSON of voiceJSON.measures) {
          if (measureJSON.rehearsalMark) {
            voice.setPendingRehearsalMark(measureJSON.rehearsalMark)
          }
          for (const noteJSON of measureJSON.notes) {
            const note = jsonToNote(noteJSON)
            voice.addNote(note, score.timeSignature)
          }
        }
      }
    }

    // Tempo changes
    if (json.tempoChanges) {
      for (const tc of json.tempoChanges) {
        score.tempoAt(tc.measure, tc.bpm)
      }
    }

    // Repeats
    if (json.repeats) {
      for (const rep of json.repeats) {
        score.addRepeatSection(rep.startMeasure, rep.endMeasure)
      }
    }

    // Da Capo
    if (json.daCapo) {
      score.setDaCapo(true)
    }

    // Dal Segno / navigation markers
    if (json.dalSegno) {
      score.setDalSegno(true)
    }
    if (json.segnoMeasure != null) {
      score.setSegnoMeasure(json.segnoMeasure)
    }
    if (json.codaMeasure != null) {
      score.setCodaMeasure(json.codaMeasure)
    }
    if (json.fineMeasure != null) {
      score.setFineMeasure(json.fineMeasure)
    }
    if (json.voltaEndings) {
      for (const v of json.voltaEndings) {
        score.addVoltaEnding(v.measure, v.ending)
      }
    }

    return score
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function noteToJSON(note: Note): ScoreJSONNote {
  const result: ScoreJSONNote = {
    pitch: note.pitch,
    octave: note.octave,
    duration: note.duration,
  }

  if (note.accidental) result.accidental = note.accidental
  if (note.dotted) result.dotted = true
  if (note.dynamic) result.dynamic = note.dynamic
  if (note.tied) result.tied = true
  if (note.slurred) result.slurred = true
  if (note.chord) result.chord = true
  if (note.chordGroup != null) result.chordGroup = note.chordGroup
  if (note.fermata) result.fermata = true
  if (note.breath) result.breath = true
  if (note.triplet) result.triplet = true
  if (note.tupletRatio) result.tupletRatio = note.tupletRatio
  if (note.lyric) result.lyric = note.lyric
  if (note.articulation) result.articulation = note.articulation
  if (note.ornament) result.ornament = note.ornament
  if (note.graceNote) result.graceNote = true
  if (note.chordSymbol) result.chordSymbol = note.chordSymbol
  if (note.glissando) result.glissando = true
  if (note.expression) result.expression = note.expression

  return result
}

function jsonToNote(json: ScoreJSONNote): Note {
  const data: NoteData = {
    pitch: json.pitch as PitchName | 'R',
    accidental: (json.accidental ?? null) as Accidental,
    octave: json.octave as Octave,
    duration: json.duration as DurationName,
    dotted: json.dotted ?? false,
    dynamic: (json.dynamic ?? null) as Dynamic | null,
    tied: json.tied ?? false,
    slurred: json.slurred ?? false,
    chord: json.chord ?? false,
    chordGroup: json.chordGroup,
    fermata: json.fermata ?? false,
    breath: json.breath ?? false,
    triplet: json.triplet ?? false,
    tupletRatio: json.tupletRatio,
    lyric: json.lyric,
    articulation: (json.articulation ?? null) as Articulation,
    ornament: (json.ornament ?? null) as Ornament,
    graceNote: json.graceNote ?? false,
    chordSymbol: json.chordSymbol,
    glissando: json.glissando ?? false,
    expression: json.expression,
  }
  return new Note(data)
}
