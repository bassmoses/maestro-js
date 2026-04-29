import MidiWriter from 'midi-writer-js'
import type { Score } from '../../model/Score.js'
import type { Note } from '../../model/Note.js'
import type { DurationName } from '../../model/types.js'

const { Track, NoteEvent, Writer } = MidiWriter

// Map Maestro duration names to midi-writer-js duration values
const DURATION_MAP: Record<DurationName, string> = {
  w: '1',
  h: '2',
  q: '4',
  e: '8',
  s: '16',
  t: '32',
}

// Map dynamic markings to MIDI velocity (1-100 scale for midi-writer-js)
const DYNAMIC_VELOCITY: Record<string, number> = {
  ppp: 13,
  pp: 25,
  p: 38,
  mp: 50,
  mf: 63,
  f: 75,
  ff: 88,
  fff: 100,
  cresc: 63,
  decresc: 50,
}

const DEFAULT_VELOCITY = 50

/**
 * Format a Note's pitch for midi-writer-js (e.g., 'C#4', 'Bb3', 'E5').
 */
function noteToPitchString(note: Note): string {
  const acc = note.accidental ?? ''
  return `${note.pitch}${acc}${note.octave}`
}

/**
 * Get the midi-writer-js duration string for a note.
 * Triplet notes use the 'T' prefix (e.g., 'T4' for triplet quarter).
 */
function noteToDuration(note: Note): string {
  const base = DURATION_MAP[note.duration]
  if (note.dotted) return `d${base}`
  if (note.triplet) return `T${base}`
  return base
}

/**
 * Adapter for exporting a Score to a standard MIDI file.
 */
export class MIDIAdapter {
  /**
   * Export a Score model to a MIDI file as a Uint8Array.
   */
  static export(score: Score): Uint8Array {
    const tracks: InstanceType<typeof Track>[] = []

    for (const part of score.getParts()) {
      for (const voice of part.getVoices()) {
        const track = new Track()

        // Set tempo on first track
        if (tracks.length === 0) {
          track.setTempo(score.tempo)
          const ts = score.timeSignature
          const denomMap: Record<string, number> = { w: 1, h: 2, q: 4, e: 8, s: 16, t: 32 }
          track.setTimeSignature(ts.beats, denomMap[ts.noteValue] ?? 4)
        }

        track.addTrackName(voice.name)

        // Apply tempo changes
        const tempoMap = score.getTempoMap()
        // Convert measure-based tempo changes to tick positions
        // Each beat = 128 ticks in midi-writer-js
        const TICKS_PER_BEAT = 128
        const beatsPerMeasure = score.timeSignature.beats
        for (const [measure, bpm] of tempoMap) {
          const tick = (measure - 1) * beatsPerMeasure * TICKS_PER_BEAT
          track.setTempo(bpm, tick)
        }

        const measures = voice.getMeasures()
        let waitDuration: string | undefined

        for (const measure of measures) {
          const notes = measure.getNotes()

          // Group chord notes together
          let i = 0
          while (i < notes.length) {
            const note = notes[i]

            if (note.isRest) {
              // Accumulate rest as wait for next note
              const dur = noteToDuration(note)
              waitDuration = waitDuration ? [waitDuration, dur].join(' ') : dur
              i++
              continue
            }

            // Check if this starts a chord group
            if (note.chord && note.chordGroup != null) {
              const chordPitches: string[] = []
              const group = note.chordGroup
              while (i < notes.length && notes[i].chord && notes[i].chordGroup === group) {
                chordPitches.push(noteToPitchString(notes[i]))
                i++
              }
              const event = new NoteEvent({
                pitch: chordPitches,
                duration: noteToDuration(note),
                velocity: DYNAMIC_VELOCITY[note.dynamic ?? ''] ?? DEFAULT_VELOCITY,
                wait: waitDuration || undefined,
              })
              track.addEvent(event)
              waitDuration = undefined
            } else {
              // Single note
              const event = new NoteEvent({
                pitch: [noteToPitchString(note)],
                duration: noteToDuration(note),
                velocity: DYNAMIC_VELOCITY[note.dynamic ?? ''] ?? DEFAULT_VELOCITY,
                wait: waitDuration || undefined,
              })
              track.addEvent(event)
              waitDuration = undefined
              i++
            }
          }
        }

        tracks.push(track)
      }
    }

    const writer = new Writer(tracks)
    return writer.buildFile()
  }
}
