// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// Mock Tone.js
vi.mock('tone', () => {
  function MockPolySynth() {
    return {
      triggerAttackRelease: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
      toDestination: vi.fn(),
    }
  }
  function MockSynth() {}
  return {
    PolySynth: MockPolySynth,
    Synth: MockSynth,
    getTransport: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
      schedule: vi.fn(() => 0),
      seconds: 0,
    })),
    getContext: vi.fn(() => ({ state: 'running' })),
    start: vi.fn(),
  }
})

// Import from the node entry point path
import { Song, Score, Note, VexFlowAdapter, Scheduler, buildScore } from '../index.js'
import { parse } from '../../parser/parser.js'
import type { NoteNode } from '../../parser/types.js'
import type { NoteData } from '../../model/types.js'

describe('Node.js Entry Point Integration', () => {
  it('should export all expected symbols', () => {
    expect(Song).toBeDefined()
    expect(Score).toBeDefined()
    expect(Note).toBeDefined()
    expect(VexFlowAdapter).toBeDefined()
    expect(Scheduler).toBeDefined()
    expect(buildScore).toBeDefined()
  })

  it('should create a Song and build a timeline without browser APIs', () => {
    const song = new Song({ tempo: 120, timeSignature: '4/4' })
    song.add('C4:q D4:q E4:q F4:q')

    const timeline = song.getTimeline()
    expect(timeline.length).toBe(4)
    expect(timeline[0].time).toBe(0)
    expect(timeline[0].note.pitch).toBe('C4')
  })

  it('should export JSON from Node', () => {
    const song = new Song({ tempo: 100 })
    song.add('E4:q F4:q G4:q A4:q')

    const json = song.exportJSON() as Record<string, unknown>
    expect(json).toHaveProperty('options')
    expect(json).toHaveProperty('defaultNotation')
    expect(json).toHaveProperty('version', 1)
  })

  it('should render SVG from Node', () => {
    const song = new Song({ tempo: 120 })
    song.add('C4:q D4:q E4:q F4:q')

    const svg = song.exportSVG()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('should support multi-voice song in Node', () => {
    const song = new Song({
      tempo: 76,
      key: 'Bb',
      title: 'Test Chorale',
    })

    song.voice('soprano', { clef: 'treble' }).add('Bb4:h C5:q D5:q')
    song.voice('bass', { clef: 'bass' }).add('Bb2:h Eb3:q F3:q')

    const timeline = song.getTimeline()
    expect(timeline.length).toBeGreaterThan(0)

    const voices = new Set(timeline.map((e) => e.note.voice))
    expect(voices.has('soprano')).toBe(true)
    expect(voices.has('bass')).toBe(true)

    const svg = song.exportSVG()
    expect(svg).toContain('<svg')
  })

  it('should handle complex notation in Node', () => {
    const song = new Song({ tempo: 112, key: 'D' })
    // Dotted notes, accidentals, dynamics
    song.add('D4:q(mp) F#4:q A4:h | A4:q(mf) G4:q F#4:h')

    const timeline = song.getTimeline()
    expect(timeline.length).toBe(6)

    const svg = song.exportSVG()
    expect(svg).toContain('<svg')
  })

  it('should build score directly via VexFlowAdapter.renderToSVG', () => {
    const score = new Score({ tempo: 100, timeSignature: '3/4', key: 'G' })
    const part = score.addPart('melody')
    const voice = part.addVoice('melody', 'treble')

    function toNote(node: NoteNode): InstanceType<typeof Note> {
      const data: NoteData = {
        pitch: node.pitch ?? 'R',
        accidental: node.accidental,
        octave: node.octave ?? 4,
        duration: node.duration,
        dotted: node.dotted,
        dynamic: node.dynamic,
        tied: node.tied,
        slurred: node.slurred,
        chord: node.chord,
      }
      return new Note(data)
    }

    const nodes = parse('G4:q A4:q B4:q')
    for (const node of nodes) {
      if (node.isBarline) continue
      voice.addNote(toNote(node), score.timeSignature)
    }

    const result = VexFlowAdapter.renderToSVG(score, { width: 500 })
    expect(result.svg).toContain('<svg')
    expect(result.width).toBe(500)
    expect(result.height).toBeGreaterThan(0)
  })
})
