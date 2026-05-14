// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { Cursor } from '../Cursor.js'

function makeSvgContainer(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
  svg.setAttribute('width', '800')
  svg.setAttribute('height', '200')
  return svg
}

describe('Cursor', () => {
  let cursor: Cursor

  beforeEach(() => {
    cursor = new Cursor({ color: '#ff0000', style: 'line', animate: false })
  })

  it('constructs without error', () => {
    expect(cursor).toBeDefined()
  })

  it('attach() inserts the cursor element into the SVG container', () => {
    const svg = makeSvgContainer()
    cursor.attach(svg)
    expect(svg.children.length).toBeGreaterThan(0)
  })

  it('detach() removes the cursor element from its container', () => {
    const svg = makeSvgContainer()
    cursor.attach(svg)
    cursor.detach()
    expect(svg.children.length).toBe(0)
  })

  it('moveTo() updates the cursor position', () => {
    const svg = makeSvgContainer()
    cursor.attach(svg)
    cursor.moveTo(120, 40)
    const el = svg.querySelector('[data-maestro-cursor]')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('transform')).toBe('translate(120, 40)')
  })

  it('moveTo() before attach() does not throw', () => {
    expect(() => cursor.moveTo(50, 10)).not.toThrow()
  })

  it('detach() before attach() does not throw', () => {
    expect(() => cursor.detach()).not.toThrow()
  })

  it('highlight-box style cursor uses rect element', () => {
    const boxCursor = new Cursor({ style: 'highlight-box', color: '#0000ff44', animate: false })
    const svg = makeSvgContainer()
    boxCursor.attach(svg)
    const el = svg.querySelector('[data-maestro-cursor]')
    expect(el?.tagName.toLowerCase()).toBe('rect')
  })

  it('line style cursor uses line element', () => {
    const svg = makeSvgContainer()
    cursor.attach(svg)
    const el = svg.querySelector('[data-maestro-cursor]')
    expect(el?.tagName.toLowerCase()).toBe('line')
  })
})
