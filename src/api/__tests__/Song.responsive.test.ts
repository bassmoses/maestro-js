// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Song } from '../Song.js'

vi.mock('../../adapters/renderer/VexFlowAdapter.js', () => ({
  VexFlowAdapter: {
    render: vi.fn(() => new Map()),
    renderToSVG: vi.fn(() => ({ svg: '<svg></svg>', width: 800, height: 200 })),
  },
}))

// Mock ResizeObserver
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
const MockResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: vi.fn(),
  }
})
vi.stubGlobal('ResizeObserver', MockResizeObserver)

describe('Song zoom and responsive', () => {
  let song: Song

  beforeEach(() => {
    vi.clearAllMocks()
    song = new Song({ tempo: 120 })
    song.add('C4:q D4:q')
  })

  it('setZoom() returns Song for chaining', () => {
    expect(song.setZoom(1.5)).toBe(song)
  })

  it('setZoom() with value 1.0 does not throw', () => {
    expect(() => song.setZoom(1.0)).not.toThrow()
  })

  it('setResponsive() returns Song for chaining', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    song.render(container)
    expect(song.setResponsive(true)).toBe(song)
    document.body.removeChild(container)
  })

  it('setResponsive(true) attaches a ResizeObserver', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    song.render(container)
    song.setResponsive(true)
    expect(MockResizeObserver).toHaveBeenCalled()
    expect(mockObserve).toHaveBeenCalled()
    document.body.removeChild(container)
  })

  it('setResponsive(false) disconnects any existing ResizeObserver', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    song.render(container)
    song.setResponsive(true)
    song.setResponsive(false)
    expect(mockDisconnect).toHaveBeenCalled()
    document.body.removeChild(container)
  })

  it('setResponsive(true) before render() does not throw', () => {
    expect(() => song.setResponsive(true)).not.toThrow()
  })
})
