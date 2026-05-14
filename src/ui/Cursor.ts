export interface CursorOptions {
  color?: string
  style?: 'line' | 'highlight-box'
  animate?: boolean
  height?: number
}

const NS = 'http://www.w3.org/2000/svg'

export class Cursor {
  private readonly color: string
  private readonly style: 'line' | 'highlight-box'
  private readonly animate: boolean
  private readonly height: number
  private el: SVGElement | null = null
  private container: SVGSVGElement | null = null

  constructor(options: CursorOptions = {}) {
    this.color = options.color ?? '#1565c0'
    this.style = options.style ?? 'line'
    this.animate = options.animate ?? true
    this.height = options.height ?? 80
  }

  attach(svgContainer: SVGSVGElement): void {
    this.detach()
    this.container = svgContainer
    this.el = this.createElement()
    svgContainer.appendChild(this.el)
  }

  detach(): void {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el)
    }
    this.el = null
    this.container = null
  }

  moveTo(x: number, y: number): void {
    if (!this.el) return
    this.el.setAttribute('transform', `translate(${x}, ${y})`)
  }

  private createElement(): SVGElement {
    if (this.style === 'line') {
      const line = document.createElementNS(NS, 'line') as SVGLineElement
      line.setAttribute('data-maestro-cursor', 'true')
      line.setAttribute('stroke', this.color)
      line.setAttribute('stroke-width', '2')
      line.setAttribute('x1', '0')
      line.setAttribute('x2', '0')
      line.setAttribute('y1', '0')
      line.setAttribute('y2', String(this.height))
      line.setAttribute('pointer-events', 'none')
      if (this.animate) {
        line.style.transition = 'transform 0.08s linear'
      }
      return line
    } else {
      const rect = document.createElementNS(NS, 'rect') as SVGRectElement
      rect.setAttribute('data-maestro-cursor', 'true')
      rect.setAttribute('fill', this.color)
      rect.setAttribute('rx', '3')
      rect.setAttribute('x', '0')
      rect.setAttribute('y', '0')
      rect.setAttribute('width', '24')
      rect.setAttribute('height', String(this.height))
      rect.setAttribute('pointer-events', 'none')
      if (this.animate) {
        rect.style.transition = 'transform 0.08s linear'
      }
      return rect
    }
  }
}
