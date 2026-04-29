export class MaestroError extends Error {
  constructor(
    message: string,
    public readonly input?: string,
    public readonly position?: number,
    public readonly length?: number
  ) {
    super(message)
    this.name = 'MaestroError'
  }

  format(): string {
    const lines: string[] = [`${this.name}: ${this.message}`]

    if (this.input !== undefined && this.position !== undefined) {
      lines.push(`  Input: "${this.input}"`)

      const arrowLength = this.length ?? 1
      const padding = ' '.repeat(this.position + 9) // 9 = length of '  Input: "'
      const arrows = '^'.repeat(arrowLength)
      lines.push(`${padding}${arrows}`)
    }

    return lines.join('\n')
  }
}
