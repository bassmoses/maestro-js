let _jsdomDocument: Document | null = null
let _jsdomWindow: Window | null = null

/**
 * Release the cached JSDOM instance to free memory.
 * Call this in long-running server processes between render batches.
 */
export function releaseJsdom(): void {
  _jsdomDocument = null
  _jsdomWindow = null
}

export function getJsdomDocument(): Document {
  if (_jsdomDocument) return _jsdomDocument
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom') as typeof import('jsdom')
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    _jsdomDocument = dom.window.document
    _jsdomWindow = dom.window as unknown as Window
    return _jsdomDocument
  } catch {
    throw new Error(
      'DOM not available. Install "jsdom" for server-side SVG rendering: npm install jsdom'
    )
  }
}

export function installJsdomGlobals(): () => void {
  const doc = getJsdomDocument()
  const prevDoc = (globalThis as Record<string, unknown>).document
  const prevWin = (globalThis as Record<string, unknown>).window
  ;(globalThis as Record<string, unknown>).document = doc
  if (_jsdomWindow) {
    ;(globalThis as Record<string, unknown>).window = _jsdomWindow
  }
  return () => {
    if (prevDoc === undefined) {
      delete (globalThis as Record<string, unknown>).document
    } else {
      ;(globalThis as Record<string, unknown>).document = prevDoc
    }
    if (prevWin === undefined) {
      delete (globalThis as Record<string, unknown>).window
    } else {
      ;(globalThis as Record<string, unknown>).window = prevWin
    }
  }
}

export function createDetachedContainer(): HTMLDivElement {
  if (typeof document !== 'undefined') {
    const div = document.createElement('div')
    div.style.position = 'absolute'
    div.style.left = '-9999px'
    document.body.appendChild(div)
    return div
  }
  const doc = getJsdomDocument()
  const div = doc.createElement('div')
  doc.body.appendChild(div)
  return div as unknown as HTMLDivElement
}

export function extractSVG(container: HTMLElement): string {
  const svgEl = container.querySelector('svg')
  if (!svgEl) return ''
  const result = svgEl.outerHTML
  if (container.parentNode) {
    container.parentNode.removeChild(container)
  }
  return result
}
