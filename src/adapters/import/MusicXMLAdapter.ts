import { XMLParser } from 'fast-xml-parser'
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
} from '../../model/types.js'
import type { Clef } from '../../model/VoiceModel.js'

// ─── Key signature table (fifths → key name) ────────────────────

const FIFTHS_TO_KEY: { [key: number]: string } = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  '0': 'C',
  '1': 'G',
  '2': 'D',
  '3': 'A',
  '4': 'E',
  '5': 'B',
  '6': 'F#',
  '7': 'C#',
}

// ─── Duration type → DurationName ────────────────────────────────

const TYPE_TO_DURATION: Record<string, DurationName> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: 'e',
  '16th': 's',
  '32nd': 't',
}

// ─── Alter → Accidental ───────────────────────────────────────────

function alterToAccidental(alter: number | undefined): Accidental {
  if (alter === undefined || alter === 0) return null
  if (alter === 1) return '#'
  if (alter === -1) return 'b'
  if (alter === 2) return '##'
  if (alter === -2) return 'bb'
  return null
}

// ─── Clef sign+line → Clef ───────────────────────────────────────

function parseClef(sign: string, line?: number): Clef {
  if (sign === 'G') return 'treble'
  if (sign === 'F') return 'bass'
  if (sign === 'C') {
    if (line === 3) return 'alto'
    if (line === 4) return 'tenor'
    return 'alto' // default for C clef
  }
  return 'treble' // fallback
}

// ─── Dynamic string extraction ────────────────────────────────────

const VALID_DYNAMICS = new Set<string>([
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'cresc',
  'decresc',
])

function parseDynamic(dynamics: unknown): Dynamic | null {
  if (!dynamics || typeof dynamics !== 'object') return null
  // MusicXML dynamics element contains child elements as keys: <p/>, <mf/>, etc.
  for (const key of Object.keys(dynamics as object)) {
    if (VALID_DYNAMICS.has(key)) return key as Dynamic
  }
  return null
}

// ─── Helper: ensure value is always an array ──────────────────────

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return []
  if (Array.isArray(val)) return val
  return [val]
}

// ─── Internal representation of a parsed MusicXML note ───────────

interface ParsedNote {
  pitch: PitchName | 'R'
  accidental: Accidental
  octave: Octave
  duration: DurationName
  dotted: boolean
  dynamic: Dynamic | null
  tied: boolean
  slurred: boolean
  chord: boolean
  fermata: boolean
  lyric?: string
  articulation: Articulation
}

// ─── MusicXML parsed element shapes (loosely typed) ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

// ─── MusicXMLAdapter ─────────────────────────────────────────────

export class MusicXMLAdapter {
  /**
   * Parse a MusicXML string and return a Score model.
   */
  static fromXML(xmlString: string): Score {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (_name, _jpath, _isLeafNode, isAttribute) => {
        if (isAttribute) return false
        // Elements that should always be arrays
        const alwaysArray = [
          'part',
          'measure',
          'note',
          'score-part',
          'dot',
          'tied',
          'lyric',
          'articulations',
        ]
        return alwaysArray.includes(_name)
      },
    })

    let parsed: AnyObj
    try {
      if (!xmlString || typeof xmlString !== 'string') {
        throw new TypeError('input must be a non-empty string')
      }
      parsed = parser.parse(xmlString) as AnyObj
    } catch (err) {
      throw new Error(`MusicXMLAdapter: failed to parse XML — ${(err as Error).message}`, {
        cause: err,
      })
    }
    const root: AnyObj = parsed['score-partwise'] ?? {}

    // ── Metadata ──────────────────────────────────────────────────
    const title: string = root['work']?.['work-title'] ?? ''
    const composer: string = (() => {
      const identification = root['identification']
      if (!identification) return ''
      const creators = toArray(identification['creator'])
      const composerNode = creators.find((c: AnyObj) => c['@_type'] === 'composer')
      return typeof composerNode === 'string' ? composerNode : (composerNode?.['#text'] ?? '')
    })()

    // ── Part list: id → part name ─────────────────────────────────
    const partNames: Record<string, string> = {}
    const partList: AnyObj = root['part-list'] ?? {}
    for (const sp of toArray(partList['score-part'])) {
      const id: string = sp['@_id']
      const name: string = sp['part-name'] ?? id
      partNames[id] = name
    }

    // ── Defaults for the whole score (taken from first measure) ───
    let globalTempo = 120
    let globalTimeSignature = '4/4'
    let globalKey = 'C'
    let globalClef: Clef = 'treble'

    // ── Walk parts ────────────────────────────────────────────────
    const parts: AnyObj[] = toArray(root['part'])

    // First pass: collect global defaults from first measure of first part
    if (parts.length > 0) {
      const firstMeasures = toArray(parts[0]['measure'])
      if (firstMeasures.length > 0) {
        const firstMeasure = firstMeasures[0] as AnyObj
        const attrs: AnyObj = firstMeasure['attributes'] ?? {}

        if (attrs['key']?.['fifths'] !== undefined) {
          const fifths = Number(attrs['key']['fifths'])
          globalKey = FIFTHS_TO_KEY[fifths] ?? 'C'
        }
        if (attrs['time']) {
          const beats = attrs['time']['beats']
          const beatType = attrs['time']['beat-type']
          if (beats && beatType) {
            globalTimeSignature = `${beats}/${beatType}`
          }
        }
        if (attrs['clef']) {
          const clefEl = attrs['clef']
          globalClef = parseClef(
            clefEl['sign'],
            clefEl['line'] ? Number(clefEl['line']) : undefined
          )
        }

        // Tempo from first direction/sound
        const dirs = toArray(firstMeasure['direction'])
        for (const dir of dirs) {
          const sound = dir['sound']
          if (sound?.['@_tempo']) {
            globalTempo = Number(sound['@_tempo'])
            break
          }
        }
      }
    }

    // ── Build the Score ───────────────────────────────────────────
    const score = new Score({
      title,
      composer,
      tempo: globalTempo,
      timeSignature: globalTimeSignature,
      key: globalKey,
    })

    // ── Second pass: build parts/voices ──────────────────────────
    for (const partEl of parts) {
      const partId: string = partEl['@_id'] ?? 'P1'
      const partName: string = partNames[partId] ?? partId

      const part = score.addPart(partName)
      // Note: mid-score clef changes are not supported; the initial clef is used for the entire voice.
      // We capture initialClef before iterating measures so that a clef change in measure 2+ does not
      // retroactively change the voice's clef setting.
      let initialClef: Clef = globalClef

      // Collect all notes across all measures (voice adds measure boundaries automatically)
      const allNotes: ParsedNote[] = []

      const measures = toArray(partEl['measure'])
      for (const measureEl of measures as AnyObj[]) {
        // Handle attribute changes mid-score (clef changes, etc.)
        const attrs: AnyObj = measureEl['attributes'] ?? {}
        if (attrs['clef']) {
          const clefEl = attrs['clef']
          const measuredClef = parseClef(
            clefEl['sign'],
            clefEl['line'] ? Number(clefEl['line']) : undefined
          )
          // Only update initialClef when we are in the very first measure
          // (allNotes is still empty at that point)
          if (allNotes.length === 0) {
            initialClef = measuredClef
          }
        }

        // Parse notes in this measure
        const noteEls = toArray(measureEl['note']) as AnyObj[]

        for (const noteEl of noteEls) {
          const isChord = 'chord' in noteEl

          // Duration type
          const typeStr: string = noteEl['type'] ?? ''
          const durName: DurationName = TYPE_TO_DURATION[typeStr] ?? 'q'

          // Dotted
          const dots = toArray(noteEl['dot'])
          const dotted = dots.length > 0

          // Rest?
          const isRest = 'rest' in noteEl

          // Pitch
          let pitch: PitchName | 'R' = 'R'
          let accidental: Accidental = null
          let octave: Octave = 4

          if (!isRest && noteEl['pitch']) {
            const pitchEl: AnyObj = noteEl['pitch']
            pitch = (pitchEl['step'] as PitchName) ?? 'C'
            octave = (Number(pitchEl['octave']) as Octave) ?? 4
            const alter = pitchEl['alter'] !== undefined ? Number(pitchEl['alter']) : undefined
            accidental = alterToAccidental(alter)
          }

          // Tied (start)
          let tied = false
          const notations: AnyObj = noteEl['notations'] ?? {}
          const tiedEls = toArray(notations['tied']) as AnyObj[]
          if (tiedEls.some((t) => t['@_type'] === 'start')) {
            tied = true
          }

          // Fermata
          const fermata = 'fermata' in notations

          // Lyric
          let lyric: string | undefined
          const lyricEls = toArray(noteEl['lyric']) as AnyObj[]
          if (lyricEls.length > 0) {
            const lyricEl = lyricEls[0]
            const text = lyricEl['text']
            if (text !== undefined) {
              lyric = String(text)
            }
          }

          // Dynamic
          // Only note-attached <notations><dynamics> are parsed.
          // Direction-level <direction><direction-type><dynamics> (used by Sibelius/Finale/MuseScore) are out of scope.
          let dynamic: Dynamic | null = null
          if (notations['dynamics']) {
            dynamic = parseDynamic(notations['dynamics'])
          }

          // Articulation
          let articulation: Articulation = null
          const articulationsEls = toArray(notations['articulations']) as AnyObj[]
          if (articulationsEls.length > 0) {
            const arts: AnyObj = articulationsEls[0]
            if ('staccato' in arts) articulation = 'staccato'
            else if ('accent' in arts) articulation = 'accent'
            else if ('tenuto' in arts) articulation = 'tenuto'
            else if ('strong-accent' in arts) articulation = 'marcato'
          }

          // (chord grouping resolved in the voice-building pass below)

          const parsedNote: ParsedNote = {
            pitch,
            accidental,
            octave,
            duration: durName,
            dotted,
            dynamic,
            tied,
            slurred: false,
            chord: isChord,
            fermata,
            lyric,
            articulation,
          }

          allNotes.push(parsedNote)
        }
      }

      // Build the voice with collected notes (use the initial clef from the first measure)
      const voice = part.addVoice('default', initialClef)

      let chordGroup = 0

      for (const pNote of allNotes) {
        if (!pNote.chord) {
          chordGroup++
        }

        const noteData: NoteData = {
          pitch: pNote.pitch,
          accidental: pNote.accidental,
          octave: pNote.octave,
          duration: pNote.duration,
          dotted: pNote.dotted,
          dynamic: pNote.dynamic,
          tied: pNote.tied,
          slurred: pNote.slurred,
          chord: pNote.chord,
          chordGroup: pNote.chord ? chordGroup : undefined,
          fermata: pNote.fermata,
          breath: false,
          triplet: false,
          lyric: pNote.lyric,
          articulation: pNote.articulation,
          expression: null,
        }

        const note = new Note(noteData)
        voice.addNote(note, score.timeSignature)
      }
    }

    return score
  }
}
