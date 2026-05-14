// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Song } from '../Song.js'

describe('ARIA labels — container', () => {
  it('render target gets role=img and aria-label containing the song title', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song({ title: 'Ode to Joy' })
    song.add('C4:q D4:q E4:q F4:q')
    song.render(div, { ariaLabel: true })
    expect(div.getAttribute('role')).toBe('img')
    expect(div.getAttribute('aria-label')).toContain('Ode to Joy')
    document.body.removeChild(div)
  })
  it('render target gets aria-label "Sheet music" when no title', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song()
    song.add('C4:q D4:q E4:q F4:q')
    song.render(div, { ariaLabel: true })
    expect(div.getAttribute('role')).toBe('img')
    expect(div.getAttribute('aria-label')).toBe('Sheet music')
    document.body.removeChild(div)
  })
  it('no aria attributes when ariaLabel is not set (default)', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const song = new Song({ title: 'Test' })
    song.add('C4:q')
    song.render(div)
    expect(div.getAttribute('role')).toBeNull()
    document.body.removeChild(div)
  })
})
