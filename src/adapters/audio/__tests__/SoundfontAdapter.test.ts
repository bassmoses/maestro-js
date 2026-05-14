// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Score } from '../../../model/Score.js'

// Mock fetch — no real network calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
})

// Mock AudioContext
const mockDecodeAudioData = vi.fn().mockResolvedValue({
  duration: 1,
  sampleRate: 44100,
  numberOfChannels: 1,
})

const mockConnect = vi.fn()
const mockStart = vi.fn()
const mockStop = vi.fn()

const mockCreateBufferSource = vi.fn(() => ({
  buffer: null as unknown,
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
  onended: null,
  playbackRate: { value: 1 },
}))

class MockAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  decodeAudioData = mockDecodeAudioData
  createBufferSource = mockCreateBufferSource
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: mockConnect,
  }))
  resume = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)
}

vi.stubGlobal('AudioContext', MockAudioContext)

// Import AFTER stubbing globals
const { SoundfontAdapter } = await import('../SoundfontAdapter.js')

describe('SoundfontAdapter', () => {
  let adapter: InstanceType<typeof SoundfontAdapter>

  beforeEach(() => {
    adapter = new SoundfontAdapter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    adapter.dispose()
  })

  it('constructs without error', () => {
    expect(adapter).toBeDefined()
  })

  it('load() accepts a Score without throwing', () => {
    const score = new Score({ tempo: 120, timeSignature: '4/4' })
    expect(() => adapter.load(score, { instrument: 'piano' })).not.toThrow()
  })

  it('dispose() does not throw when called before load()', () => {
    const fresh = new SoundfontAdapter()
    expect(() => fresh.dispose()).not.toThrow()
  })

  it('on() registers event handler without throwing', () => {
    expect(() => adapter.on('note', vi.fn())).not.toThrow()
  })

  it('off() unregisters event handler without throwing', () => {
    const handler = vi.fn()
    adapter.on('note', handler)
    expect(() => adapter.off('note', handler)).not.toThrow()
  })

  it('stop() does not throw when not playing', () => {
    expect(() => adapter.stop()).not.toThrow()
  })

  it('getSoundfontUrl() returns URL containing instrument name', () => {
    const url = SoundfontAdapter.getSoundfontUrl('acoustic_grand_piano', 'MusyngKite')
    expect(url).toContain('acoustic_grand_piano')
    expect(url).toContain('MusyngKite')
  })

  it('midiToNoteName() converts MIDI 60 to C4', () => {
    expect(SoundfontAdapter.midiToNoteName(60)).toBe('C4')
  })

  it('midiToNoteName() converts MIDI 69 to A4', () => {
    expect(SoundfontAdapter.midiToNoteName(69)).toBe('A4')
  })

  it('midiToNoteName() converts MIDI 21 to A0', () => {
    expect(SoundfontAdapter.midiToNoteName(21)).toBe('A0')
  })
})
