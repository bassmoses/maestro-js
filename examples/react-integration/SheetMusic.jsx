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
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => songRef.current?.play()}>Play</button>
        <button onClick={() => songRef.current?.pause()}>Pause</button>
        <button onClick={() => songRef.current?.stop()}>Stop</button>
      </div>
    </div>
  )
}
