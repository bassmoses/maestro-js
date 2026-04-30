import { describe, it, expect } from 'vitest'
import { Score } from '../../model/Score.js'
import { Song } from '../../api/Song.js'

describe('Loop support', () => {
  describe('Score', () => {
    it('has no loop by default', () => {
      const score = new Score()
      expect(score.getLoop()).toBeNull()
    })

    it('sets a loop range', () => {
      const score = new Score()
      score.setLoop(2, 4)
      expect(score.getLoop()).toEqual({ startMeasure: 2, endMeasure: 4 })
    })

    it('clears a loop', () => {
      const score = new Score()
      score.setLoop(1, 3)
      score.clearLoop()
      expect(score.getLoop()).toBeNull()
    })

    it('overwrites loop when set again', () => {
      const score = new Score()
      score.setLoop(1, 2)
      score.setLoop(3, 5)
      expect(score.getLoop()).toEqual({ startMeasure: 3, endMeasure: 5 })
    })

    it('rejects invalid loop ranges', () => {
      const score = new Score()
      expect(() => score.setLoop(0, 2)).toThrow('must be >= 1')
      expect(() => score.setLoop(3, 1)).toThrow('must be >= startMeasure')
      expect(() => score.setLoop(-1, 2)).toThrow('must be >= 1')
    })
  })

  describe('Song API', () => {
    it('sets and clears loop via Song', () => {
      const song = new Song()
      song.add('C4:q D4:q E4:q F4:q')

      song.loop(1, 2)
      expect(song.getScore().getLoop()).toEqual({ startMeasure: 1, endMeasure: 2 })

      song.clearLoop()
      expect(song.getScore().getLoop()).toBeNull()
    })

    it('persists loop across rebuilds', () => {
      const song = new Song()
      song.add('C4:q D4:q E4:q F4:q')
      song.loop(1, 2)

      // add() triggers rebuildScore() — loop should survive
      song.add('G4:q A4:q B4:q C5:q')
      expect(song.getScore().getLoop()).toEqual({ startMeasure: 1, endMeasure: 2 })
    })
  })
})
