import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'

describe('Multi-measure rest parsing', () => {
  it('parses R:2m as a multi-measure rest of 2 bars', () => {
    const nodes = parse('R:2m')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('rest')
    expect(nodes[0].multiMeasureRest).toBe(2)
  })

  it('parses R:4m as a multi-measure rest of 4 bars', () => {
    const nodes = parse('R:4m')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].multiMeasureRest).toBe(4)
  })

  it('parses R:1m as single-measure rest shorthand', () => {
    const nodes = parse('R:1m')
    expect(nodes[0].multiMeasureRest).toBe(1)
  })

  it('regular R:q is NOT a multi-measure rest', () => {
    const nodes = parse('R:q')
    expect((nodes[0] as { multiMeasureRest?: number }).multiMeasureRest).toBeUndefined()
  })

  it('multi-measure rest can appear among other notes', () => {
    const nodes = parse('C4:q R:2m D4:q')
    expect(nodes).toHaveLength(3)
    expect(nodes[1].multiMeasureRest).toBe(2)
  })
})
