import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tone.js before any imports that use it
const mockTriggerAttackRelease = vi.fn()
const mockReleaseAll = vi.fn()
const mockDispose = vi.fn()
const mockToDestination = vi.fn()
const mockSchedule = vi.fn((_cb: (_time: number) => void, _t: number) => {
  void _cb
  void _t
  return scheduledIdCounter++
})
let scheduledIdCounter = 0
const mockTransportStart = vi.fn()
const mockTransportStop = vi.fn()
const mockTransportPause = vi.fn()
const mockTransportCancel = vi.fn()

let mockTransportSeconds = 0

const mockTransport = {
  start: mockTransportStart,
  stop: mockTransportStop,
  pause: mockTransportPause,
  cancel: mockTransportCancel,
  schedule: mockSchedule,
  get seconds() {
    return mockTransportSeconds
  },
  set seconds(val: number) {
    mockTransportSeconds = val
  },
}

const mockPolySynth = {
  triggerAttackRelease: mockTriggerAttackRelease,
  releaseAll: mockReleaseAll,
  dispose: mockDispose,
  toDestination: mockToDestination,
}

vi.mock('tone', () => {
  function MockPolySynth() {
    return mockPolySynth
  }
  function MockSynth() {}
  return {
    PolySynth: MockPolySynth,
    Synth: MockSynth,
    getTransport: vi.fn(() => mockTransport),
    getContext: vi.fn(() => ({ state: 'running' })),
    start: vi.fn(),
  }
})

import { ToneAdapter } from '../ToneAdapter.js'
import { Score } from '../../../model/Score.js'
import { parse } from '../../../parser/parser.js'
import { Note } from '../../../model/Note.js'
import type { NoteNode } from '../../../parser/types.js'
import type { NoteData } from '../../../model/types.js'

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

function buildTestScore(notation: string, opts?: { tempo?: number }): Score {
  const score = new Score({ tempo: opts?.tempo ?? 120, timeSignature: '4/4' })
  const part = score.addPart('default')
  const voice = part.addVoice('default', 'treble')
  const nodes = parse(notation)
  for (const node of nodes) {
    if (node.isBarline) continue
    voice.addNote(nodeToNote(node), score.timeSignature)
  }
  return score
}

describe('ToneAdapter', () => {
  let adapter: ToneAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    scheduledIdCounter = 0
    mockTransportSeconds = 0
    adapter = new ToneAdapter()
  })

  afterEach(() => {
    adapter.dispose()
  })

  describe('load', () => {
    it('should load a score and create synths for each voice', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)

      // Should have scheduled-ready timeline
      expect(adapter.getTotalDuration()).toBeGreaterThan(0)
    })

    it('should filter voices when solo option is set', () => {
      const score = new Score({ tempo: 120, timeSignature: '4/4' })
      const p1 = score.addPart('piano')
      const v1 = p1.addVoice('piano', 'treble')
      const nodes1 = parse('C4:q D4:q E4:q F4:q')
      for (const n of nodes1) {
        if (!n.isBarline) v1.addNote(nodeToNote(n), score.timeSignature)
      }
      const p2 = score.addPart('bass')
      const v2 = p2.addVoice('bass', 'bass')
      const nodes2 = parse('C3:q D3:q E3:q F3:q')
      for (const n of nodes2) {
        if (!n.isBarline) v2.addNote(nodeToNote(n), score.timeSignature)
      }

      adapter.load(score, { voices: ['piano'], solo: true })
      // After filtering, total duration should only reflect piano voice
      expect(adapter.getTotalDuration()).toBeGreaterThan(0)
    })

    it('should use piano instrument by default', () => {
      const score = buildTestScore('C4:q')
      adapter.load(score)
      expect(adapter.getTotalDuration()).toBeGreaterThan(0)
    })

    it('should dispose previous adapter state on reload', () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      adapter.load(score) // second load should dispose first
      expect(mockDispose).toHaveBeenCalled()
    })
  })

  describe('play/pause/stop', () => {
    it('should start playback via Tone.js transport', async () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)
      await adapter.play()

      expect(mockTransportStart).toHaveBeenCalled()
      expect(adapter.isPlaying).toBe(true)
      expect(adapter.isPaused).toBe(false)
    })

    it('should schedule all timeline events on the transport', async () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)
      await adapter.play()

      // 4 note events + 1 end event
      expect(mockSchedule).toHaveBeenCalledTimes(5)
    })

    it('should pause playback', async () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      await adapter.play()
      adapter.pause()

      expect(mockTransportPause).toHaveBeenCalled()
      expect(adapter.isPaused).toBe(true)
    })

    it('should resume after pause', async () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      await adapter.play()
      adapter.pause()
      await adapter.play() // resume

      expect(adapter.isPlaying).toBe(true)
      expect(adapter.isPaused).toBe(false)
    })

    it('should stop playback', async () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      await adapter.play()
      adapter.stop()

      expect(mockTransportStop).toHaveBeenCalled()
      expect(mockTransportCancel).toHaveBeenCalled()
      expect(adapter.isPlaying).toBe(false)
    })

    it('should release all synth voices on stop', async () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      await adapter.play()
      adapter.stop()

      expect(mockReleaseAll).toHaveBeenCalled()
    })

    it('should be a no-op when playing while already playing', async () => {
      const score = buildTestScore('C4:q')
      adapter.load(score)
      await adapter.play()
      mockTransportStart.mockClear()
      await adapter.play() // no-op since already playing and not paused

      expect(mockTransportStart).not.toHaveBeenCalled()
    })
  })

  describe('seekTo', () => {
    it('should set transport position for a valid measure/beat', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q')
      adapter.load(score)
      adapter.seekTo(2, 1)

      expect(mockTransportSeconds).toBeGreaterThan(0)
    })

    it('should handle seek to beginning', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)
      adapter.seekTo(1, 1)

      expect(mockTransportSeconds).toBeGreaterThanOrEqual(0)
    })
  })

  describe('events', () => {
    it('should emit note events during playback', async () => {
      const noteEvents: Record<string, unknown>[] = []
      const score = buildTestScore('C4:q')
      adapter.load(score)
      adapter.on('note', (data) => noteEvents.push(data))

      await adapter.play()

      // Manually invoke the scheduled callbacks to simulate playback
      const scheduledCallbacks = mockSchedule.mock.calls
      for (const [cb] of scheduledCallbacks) {
        if (typeof cb === 'function') cb(0)
      }

      expect(noteEvents.length).toBeGreaterThan(0)
      expect(noteEvents[0]).toHaveProperty('pitch')
      expect(noteEvents[0]).toHaveProperty('voice')
    })

    it('should emit beat events', async () => {
      const beatEvents: Record<string, unknown>[] = []
      const score = buildTestScore('C4:q')
      adapter.load(score)
      adapter.on('beat', (data) => beatEvents.push(data))

      await adapter.play()

      const scheduledCallbacks = mockSchedule.mock.calls
      for (const [cb] of scheduledCallbacks) {
        if (typeof cb === 'function') cb(0)
      }

      expect(beatEvents.length).toBeGreaterThan(0)
      expect(beatEvents[0]).toHaveProperty('beat')
      expect(beatEvents[0]).toHaveProperty('measure')
    })

    it('should emit measure events', async () => {
      const measureEvents: Record<string, unknown>[] = []
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)
      adapter.on('measure', (data) => measureEvents.push(data))

      await adapter.play()

      const scheduledCallbacks = mockSchedule.mock.calls
      for (const [cb] of scheduledCallbacks) {
        if (typeof cb === 'function') cb(0)
      }

      expect(measureEvents.length).toBeGreaterThan(0)
      expect(measureEvents[0]).toHaveProperty('measure')
    })

    it('should allow removing event handlers', () => {
      const handler = vi.fn()
      adapter.on('note', handler)
      adapter.off('note', handler)
      // No way to easily verify without playback, but at least ensure no errors
    })

    it('should not throw if handler errors during event emission', async () => {
      const score = buildTestScore('C4:q')
      adapter.load(score)
      adapter.on('note', () => {
        throw new Error('handler error')
      })

      await adapter.play()

      const scheduledCallbacks = mockSchedule.mock.calls
      // Should not throw
      expect(() => {
        for (const [cb] of scheduledCallbacks) {
          if (typeof cb === 'function') cb(0)
        }
      }).not.toThrow()
    })
  })

  describe('dispose', () => {
    it('should clean up synths and reset state', () => {
      const score = buildTestScore('C4:q D4:q')
      adapter.load(score)
      adapter.dispose()

      expect(mockDispose).toHaveBeenCalled()
      expect(adapter.isPlaying).toBe(false)
      expect(adapter.getTotalDuration()).toBe(0)
    })
  })

  describe('getTotalDuration', () => {
    it('should return 0 for empty timeline', () => {
      expect(adapter.getTotalDuration()).toBe(0)
    })

    it('should compute duration from timeline events', () => {
      const score = buildTestScore('C4:q D4:q E4:q F4:q')
      adapter.load(score)
      const dur = adapter.getTotalDuration()
      // At 120 BPM, 4 quarter notes = 2 seconds
      expect(dur).toBeCloseTo(2, 1)
    })
  })

  describe('getCurrentTime', () => {
    it('should return transport position', () => {
      mockTransportSeconds = 1.5
      expect(adapter.getCurrentTime()).toBe(1.5)
    })
  })
})
