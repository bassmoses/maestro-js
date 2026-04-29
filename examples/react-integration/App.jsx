import { SheetMusic } from './SheetMusic'

export default function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Maestro.js + React</h1>

      <h2>Simple Scale</h2>
      <SheetMusic notation="C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | C5:w" tempo={100} />

      <h2>With Dynamics</h2>
      <SheetMusic notation="C4:q(p) E4:q(mp) G4:q(mf) C5:q(f) | C5:w(ff)" tempo={80} />
    </div>
  )
}
