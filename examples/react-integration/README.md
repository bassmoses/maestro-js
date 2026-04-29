# React Integration Example

A reusable React component that wraps Maestro.js for rendering sheet music and playback.

## Install

```bash
npm install maestro-js react react-dom
```

## Component

```jsx
// SheetMusic.jsx
import { useEffect, useRef } from 'react'
import { Song } from 'maestro-js'

export function SheetMusic({ notation, tempo = 120, options = {} }) {
  const containerRef = useRef(null)
  const songRef = useRef(null)

  useEffect(() => {
    const song = new Song({ tempo, ...options })
    song.add(notation)
    song.render(containerRef.current)
    songRef.current = song
    return () => song.stop()
  }, [notation, tempo])

  return (
    <div>
      <div ref={containerRef} />
      <button onClick={() => songRef.current?.play()}>Play</button>
      <button onClick={() => songRef.current?.pause()}>Pause</button>
      <button onClick={() => songRef.current?.stop()}>Stop</button>
    </div>
  )
}
```

## Usage

```jsx
import { SheetMusic } from './SheetMusic'

function App() {
  return <SheetMusic notation="C4:q D4:q E4:q F4:q | G4:h E4:h | C4:w" tempo={100} />
}
```

## Features Demonstrated

- React `useEffect` lifecycle integration
- `useRef` for imperative Song control
- Cleanup on unmount (stops playback)
- Re-renders when notation or tempo props change
- Play/Pause/Stop buttons wired to the Song instance
