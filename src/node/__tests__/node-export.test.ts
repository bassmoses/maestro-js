// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// Mock Tone.js (Song imports it dynamically)
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

import { Song } from '../../api/Song.js'
import { VexFlowAdapter } from '../../adapters/renderer/VexFlowAdapter.js'
import { Score } from '../../model/Score.js'
import { parse } from '../../parser/parser.js'
import { Note } from '../../model/Note.js'
import type { NoteNode } from '../../parser/types.js'
import type { NoteData } from '../../model/types.js'

function nodeToNote(node: NoteNode): Note {
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

function buildTestScore(notation: string): Score {
  const score = new Score({ tempo: 120, timeSignature: '4/4' })
  const part = score.addPart('default')
  const voice = part.addVoice('default', 'treble')
  const nodes = parse(notation)
  for (const node of nodes) {
    if (node.isBarline) continue
    voice.addNote(nodeToNote(node), score.timeSignature)
  }
  return score
}

describe('Node.js SVG Export', () => {
  describe('VexFlowAdapter.renderToSVG', () => {
    it('should render a simple melody to SVG', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
      expect(result.svg).toContain('</svg>')
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
    })

    it('should render with custom width', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      const result = VexFlowAdapter.renderToSVG(score, { width: 600 })

      expect(result.width).toBe(600)
      expect(result.svg).toContain('<svg')
    })

    it('should render with dark theme', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      const result = VexFlowAdapter.renderToSVG(score, { theme: 'dark' })

      expect(result.svg).toContain('<svg')
    })

    it('should render chords', () => {
      const score = buildTestScore('[C4 E4 G4]:h [F4 A4 C5]:h')
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
    })

    it('should render rests', () => {
      const score = buildTestScore('C4:q R:q E4:q R:q')
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
    })

    it('should render with dynamics', () => {
      const score = buildTestScore('C4:q(mf) D4:q E4:q(f) F4:q')
      const result = VexFlowAdapter.renderToSVG(score, { showDynamics: true })

      expect(result.svg).toContain('<svg')
    })

    it('should render dotted notes', () => {
      const score = buildTestScore('C4:h. E4:q')
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
    })

    it('should render a score with title and composer', () => {
      const score = new Score({
        tempo: 120,
        timeSignature: '4/4',
        title: 'Test Piece',
        composer: 'Test Composer',
      })
      const part = score.addPart('default')
      const voice = part.addVoice('default', 'treble')
      const nodes = parse('C4:q D4:q E4:q F4:q')
      for (const n of nodes) {
        if (!n.isBarline) voice.addNote(nodeToNote(n), score.timeSignature)
      }
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
    })

    it('should render multiple measures', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
      const result = VexFlowAdapter.renderToSVG(score)

      expect(result.svg).toContain('<svg')
    })
  })

  describe('Song.exportSVG', () => {
    it('should export SVG string from Song', () => {
      const song = new Song({ tempo: 120 })
      song.add('C4:q D4:q E4:q F4:q')

      const svg = song.exportSVG()
      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
    })

    it('should export SVG with render options', () => {
      const song = new Song({ tempo: 120 })
      song.add('C4:q D4:q E4:q F4:q')

      const svg = song.exportSVG({ width: 600, theme: 'dark' })
      expect(svg).toContain('<svg')
    })

    it('should export SVG for multi-voice song', () => {
      const song = new Song({ tempo: 100, key: 'G' })
      song.voice('soprano', { clef: 'treble' }).add('G4:q A4:q B4:q C5:q')
      song.voice('bass', { clef: 'bass' }).add('G2:q A2:q B2:q C3:q')

      const svg = song.exportSVG()
      expect(svg).toContain('<svg')
    })

    it('should export SVG for song with title', () => {
      const song = new Song({
        tempo: 90,
        title: 'My Song',
        composer: 'Test Author',
      })
      song.add('C4:h D4:h | E4:w')

      const svg = song.exportSVG()
      expect(svg).toContain('<svg')
    })
  })

  describe('Song.exportPNG', () => {
    it('should throw helpful error when sharp is not installed', async () => {
      const song = new Song()
      song.add('C4:q D4:q E4:q F4:q')

      await expect(song.exportPNG()).rejects.toThrow('sharp')
    })
  })
})
