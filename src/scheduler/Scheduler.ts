import { Score } from '../model/Score.js'
import { Note } from '../model/Note.js'
import { durationToBeats, beatsToSeconds } from '../model/Duration.js'
import { Timeline, TimelineEvent, NoteEvent } from './timeline.js'

const DYNAMIC_VELOCITY: Record<string, number> = {
  ppp: 16,
  pp: 32,
  p: 48,
  mp: 64,
  mf: 80,
  f: 96,
  ff: 112,
  fff: 127,
  cresc: 80, // TODO: interpolate cresc/decresc velocity across passages
  decresc: 64, // TODO: interpolate cresc/decresc velocity across passages
}

const DEFAULT_VELOCITY = 64 // mp default

const FERMATA_MULTIPLIER = 2.0 // fermata doubles the note duration

// Articulation effects: [durationMultiplier, velocityDelta]
const ARTICULATION_EFFECTS: Record<string, [number, number]> = {
  staccato: [0.5, 0],
  accent: [1.0, 20],
  tenuto: [1.0, 5],
  marcato: [0.5, 30],
}

/**
 * Format a Note's pitch to a string like 'C4', 'D#5', 'Bb3', or null for rests.
 */
function formatPitch(note: Note): string | null {
  if (note.isRest) return null
  const acc = note.accidental ?? ''
  return `${note.pitch}${acc}${note.octave}`
}

/**
 * Convert a dynamic string to a MIDI velocity value.
 */
function dynamicToVelocity(dynamic: string | null): number {
  if (dynamic === null) return DEFAULT_VELOCITY
  return DYNAMIC_VELOCITY[dynamic] ?? DEFAULT_VELOCITY
}

export class Scheduler {
  /**
   * Build a flat Timeline from a Score.
   * Stateless: same Score always returns same Timeline.
   * Events are sorted by time ascending.
   */
  static buildTimeline(score: Score): Timeline {
    const events: TimelineEvent[] = []

    // Build measure order, unrolling repeats
    const measureOrder = Scheduler.buildMeasureOrder(score)

    for (const part of score.getParts()) {
      for (const voice of part.getVoices()) {
        let currentChordGroup = -1
        let chordBeats = 0

        const measures = voice.getMeasures()

        // Track time using measure-start seconds + local beat offset
        // This correctly handles tempo changes between measures
        let measureStartTime = 0
        let totalBeatsAccumulated = 0

        for (const measureIndex of measureOrder) {
          if (measureIndex >= measures.length) continue
          const measure = measures[measureIndex]
          const measureNumber = measureIndex + 1
          let localBeat = 0

          // Get tempo for this measure (supports mid-piece tempo changes)
          const tempo = score.getTempoAtMeasure(measureNumber)

          for (const note of measure.getNotes()) {
            const beats = durationToBeats(note.duration, note.dotted)
            const baseDurationSecs = beatsToSeconds(beats, tempo)
            const afterFermataSecs = note.fermata
              ? baseDurationSecs * FERMATA_MULTIPLIER
              : baseDurationSecs

            // Apply articulation effects
            const artEffect = note.articulation ? ARTICULATION_EFFECTS[note.articulation] : null
            const durationSecs = artEffect ? afterFermataSecs * artEffect[0] : afterFermataSecs

            if (note.chord && note.chordGroup != null) {
              if (note.chordGroup !== currentChordGroup) {
                // New chord group — flush previous chord if any
                if (currentChordGroup >= 0) {
                  totalBeatsAccumulated += chordBeats
                  localBeat += chordBeats
                }
                currentChordGroup = note.chordGroup
                chordBeats = beats
              }
              // All notes in same chord group share currentTime
            } else {
              // Non-chord note — flush any pending chord
              if (currentChordGroup >= 0) {
                totalBeatsAccumulated += chordBeats
                localBeat += chordBeats
                currentChordGroup = -1
              }
            }

            // Compute time: measure start + offset within measure at current tempo
            const currentTime = measureStartTime + beatsToSeconds(localBeat, tempo)

            const baseVelocity = dynamicToVelocity(note.dynamic)
            const velocity = artEffect ? Math.min(127, baseVelocity + artEffect[1]) : baseVelocity

            const noteEvent: NoteEvent = {
              pitch: formatPitch(note),
              midi: note.midi,
              frequency: note.frequency,
              duration: durationSecs,
              velocity,
              voice: voice.name,
              measure: measureNumber,
              beat: totalBeatsAccumulated,
              tied: note.tied,
              chord: note.chord,
            }

            events.push({
              time: currentTime,
              note: noteEvent,
            })

            if (!note.chord) {
              totalBeatsAccumulated += beats
              localBeat += beats
            }
          }

          // If measure ended inside a chord, flush it
          if (currentChordGroup >= 0) {
            totalBeatsAccumulated += chordBeats
            localBeat += chordBeats
            currentChordGroup = -1
          }

          // Advance measure start time by the duration of this measure
          measureStartTime += beatsToSeconds(localBeat, tempo)
        }
      }
    }

    // Sort by time ascending (stable)
    events.sort((a, b) => a.time - b.time)

    return events
  }

  /**
   * Build the order of measures to play, unrolling repeats and da capo.
   * Returns an array of 0-based measure indices.
   */
  private static buildMeasureOrder(score: Score): number[] {
    // Get the total number of measures from the first voice
    let totalMeasures = 0
    for (const part of score.getParts()) {
      for (const voice of part.getVoices()) {
        totalMeasures = Math.max(totalMeasures, voice.getMeasures().length)
      }
    }

    if (totalMeasures === 0) return []

    const repeats = [...score.getRepeatSections()]
    const daCapo = score.getDaCapo()

    // If no repeats and no da capo, simple sequential order
    if (repeats.length === 0 && !daCapo) {
      return Array.from({ length: totalMeasures }, (_, i) => i)
    }

    // Build order with repeats unrolled
    const order: number[] = []
    let i = 0

    while (i < totalMeasures) {
      order.push(i)

      // Check if this measure ends a repeat section (1-based check)
      const measureNum = i + 1
      const repeat = repeats.find((r) => r.endMeasure === measureNum)
      if (repeat) {
        // Replay from start of repeat section
        for (let m = repeat.startMeasure - 1; m <= repeat.endMeasure - 1; m++) {
          order.push(m)
        }
        // Remove this repeat so it only fires once
        const idx = repeats.indexOf(repeat)
        repeats.splice(idx, 1)
      }

      i++
    }

    // Da Capo: replay from beginning
    if (daCapo) {
      for (let m = 0; m < totalMeasures; m++) {
        order.push(m)
      }
    }

    return order
  }

  /**
   * Merge tied notes in a timeline: the first note in a tie chain gets
   * the combined duration; continuation notes are removed.
   */
  static mergeTies(timeline: Timeline): Timeline {
    // Group events by voice
    const byVoice = new Map<string, TimelineEvent[]>()
    for (const event of timeline) {
      const voice = event.note.voice
      if (!byVoice.has(voice)) byVoice.set(voice, [])
      byVoice.get(voice)!.push(event)
    }

    const removals = new Set<TimelineEvent>()

    for (const [, events] of byVoice) {
      // Sort by time within voice
      events.sort((a, b) => a.time - b.time)

      for (let i = 0; i < events.length; i++) {
        const ev = events[i]
        if (!ev.note.tied || removals.has(ev)) continue

        // Find continuation: next event with same pitch in this voice
        let totalDuration = ev.note.duration
        let j = i + 1
        while (j < events.length) {
          const next = events[j]
          if (next.note.pitch === ev.note.pitch && !removals.has(next)) {
            totalDuration += next.note.duration
            removals.add(next)
            if (!next.note.tied) break // end of tie chain
            j++
          } else {
            break
          }
        }
        ev.note.duration = totalDuration
        ev.note.tied = false
      }
    }

    return timeline.filter((ev) => !removals.has(ev))
  }
}
