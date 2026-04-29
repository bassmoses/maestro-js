import { describe, it, expect } from 'vitest'
import { MaestroError } from '../errors.js'

describe('MaestroError', () => {
  it('has the correct name', () => {
    const err = new MaestroError('test message')
    expect(err.name).toBe('MaestroError')
    expect(err.message).toBe('test message')
  })

  it('is an instance of Error', () => {
    const err = new MaestroError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(MaestroError)
  })

  it('stores input, position, and length', () => {
    const err = new MaestroError('bad note', 'C4:q H4:q', 5, 4)
    expect(err.input).toBe('C4:q H4:q')
    expect(err.position).toBe(5)
    expect(err.length).toBe(4)
  })

  it('format() returns at minimum the error name and message', () => {
    const err = new MaestroError('Invalid pitch "H"')
    const formatted = err.format()
    expect(formatted).toContain('MaestroError')
    expect(formatted).toContain('Invalid pitch "H"')
  })

  it('format() includes input when provided', () => {
    const err = new MaestroError('Invalid pitch', 'C4:q H4:q', 5, 4)
    const formatted = err.format()
    expect(formatted).toContain('C4:q H4:q')
  })

  it('format() includes arrow indicator when input and position provided', () => {
    const err = new MaestroError('Invalid pitch', 'C4:q H4:q', 5, 4)
    const formatted = err.format()
    expect(formatted).toContain('^')
  })

  it('format() works without input/position', () => {
    const err = new MaestroError('Generic error')
    expect(() => err.format()).not.toThrow()
    const formatted = err.format()
    expect(formatted).toContain('Generic error')
  })

  it('format() handles single-char length (default arrow)', () => {
    const err = new MaestroError('Bad char', 'C4:q @', 5)
    const formatted = err.format()
    expect(formatted).toContain('^')
  })
})
