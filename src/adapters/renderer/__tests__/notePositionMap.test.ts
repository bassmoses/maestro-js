import { describe, it, expect } from 'vitest'
import type { NotePositionMap, NotePosition } from '../types.js'

describe('NotePositionMap type contract', () => {
  it('is a Map<number, NotePosition>', () => {
    const map: NotePositionMap = new Map<number, NotePosition>()
    map.set(0, {
      noteIndex: 0,
      x: 100,
      y: 50,
      width: 12,
      measureIndex: 0,
      voiceIndex: 0,
      svgElement: null,
    })
    expect(map.get(0)?.x).toBe(100)
    expect(map.get(0)?.measureIndex).toBe(0)
  })

  it('returns undefined for missing noteIndex', () => {
    const map: NotePositionMap = new Map()
    expect(map.get(99)).toBeUndefined()
  })
})
