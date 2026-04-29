import { Song } from 'maestro-js'

const song = new Song({ tempo: 100 })
song.add('C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | C5:w')
song.render('#sheet')

document.getElementById('play').addEventListener('click', () => song.play())
document.getElementById('stop').addEventListener('click', () => song.stop())
