import { describe, it, expect } from 'vitest'
import { MusicXMLAdapter } from '../MusicXMLAdapter.js'

// ─── Minimal MusicXML helper ──────────────────────────────────────

function buildMusicXML(opts: {
  title?: string
  composer?: string
  partName?: string
  partId?: string
  fifths?: number
  beats?: number
  beatType?: number
  clefSign?: string
  clefLine?: number
  tempo?: number
  notesXml?: string
}): string {
  const {
    title = 'Test Song',
    composer = 'Test Composer',
    partName = 'Piano',
    partId = 'P1',
    fifths = 0,
    beats = 4,
    beatType = 4,
    clefSign = 'G',
    clefLine = 2,
    tempo = 120,
    notesXml = `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`,
  } = opts

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <identification><creator type="composer">${composer}</creator></identification>
  <part-list>
    <score-part id="${partId}"><part-name>${partName}</part-name></score-part>
  </part-list>
  <part id="${partId}">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>${fifths}</fifths></key>
        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>
        <clef><sign>${clefSign}</sign><line>${clefLine}</line></clef>
      </attributes>
      <direction placement="above">
        <sound tempo="${tempo}"/>
      </direction>
      ${notesXml}
    </measure>
  </part>
</score-partwise>`
}

// ─── Tests ────────────────────────────────────────────────────────

describe('MusicXMLAdapter.fromXML', () => {
  describe('metadata', () => {
    it('extracts title from <work-title>', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ title: 'My Symphony' }))
      expect(score.title).toBe('My Symphony')
    })

    it('extracts composer from <creator type="composer">', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ composer: 'J.S. Bach' }))
      expect(score.composer).toBe('J.S. Bach')
    })

    it('uses empty string for missing title', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`
      const score = MusicXMLAdapter.fromXML(xml)
      expect(score.title).toBe('')
    })
  })

  describe('key signature', () => {
    it('maps fifths=0 to C', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: 0 }))
      expect(score.key).toBe('C')
    })

    it('maps fifths=1 to G', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: 1 }))
      expect(score.key).toBe('G')
    })

    it('maps fifths=2 to D', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: 2 }))
      expect(score.key).toBe('D')
    })

    it('maps fifths=-1 to F', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: -1 }))
      expect(score.key).toBe('F')
    })

    it('maps fifths=-2 to Bb', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: -2 }))
      expect(score.key).toBe('Bb')
    })

    it('maps fifths=6 to F#', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ fifths: 6 }))
      expect(score.key).toBe('F#')
    })
  })

  describe('time signature', () => {
    it('parses 4/4 time', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ beats: 4, beatType: 4 }))
      expect(score.timeSignature.beats).toBe(4)
      expect(score.timeSignature.noteValue).toBe('q')
    })

    it('parses 3/4 time', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ beats: 3, beatType: 4 }))
      expect(score.timeSignature.beats).toBe(3)
    })

    it('parses 6/8 time', () => {
      const score = MusicXMLAdapter.fromXML(
        buildMusicXML({
          beats: 6,
          beatType: 8,
          // Use only 3 eighth notes to avoid overflow in 6/8
          notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
        `,
        })
      )
      expect(score.timeSignature.beats).toBe(6)
      expect(score.timeSignature.noteValue).toBe('e')
    })
  })

  describe('tempo', () => {
    it('extracts tempo from <sound tempo="120"/>', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ tempo: 120 }))
      expect(score.tempo).toBe(120)
    })

    it('extracts non-default tempo', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ tempo: 96 }))
      expect(score.tempo).toBe(96)
    })
  })

  describe('clef', () => {
    it('maps G clef to treble', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ clefSign: 'G', clefLine: 2 }))
      const voices = score.getParts()[0].getVoices()
      expect(voices[0].clef).toBe('treble')
    })

    it('maps F clef to bass', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ clefSign: 'F', clefLine: 4 }))
      const voices = score.getParts()[0].getVoices()
      expect(voices[0].clef).toBe('bass')
    })

    it('maps C clef line 3 to alto', () => {
      const score = MusicXMLAdapter.fromXML(
        buildMusicXML({
          clefSign: 'C',
          clefLine: 3,
          notesXml: `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`,
        })
      )
      const voices = score.getParts()[0].getVoices()
      expect(voices[0].clef).toBe('alto')
    })

    it('maps C clef line 4 to tenor', () => {
      const score = MusicXMLAdapter.fromXML(
        buildMusicXML({
          clefSign: 'C',
          clefLine: 4,
          notesXml: `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`,
        })
      )
      const voices = score.getParts()[0].getVoices()
      expect(voices[0].clef).toBe('tenor')
    })
  })

  describe('part / voice structure', () => {
    it('creates a part with the name from part-list', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ partName: 'Violin' }))
      const parts = score.getParts()
      expect(parts).toHaveLength(1)
      expect(parts[0].name).toBe('Violin')
    })

    it('creates a default voice inside the part', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({}))
      const voices = score.getParts()[0].getVoices()
      expect(voices).toHaveLength(1)
      expect(voices[0].name).toBe('default')
    })
  })

  describe('basic note parsing', () => {
    const basicNotesXml = `
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>1</duration><type>quarter</type></note>
    `

    it('parses C4 quarter note', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ notesXml: basicNotesXml }))
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].pitch).toBe('C')
      expect(notes[0].octave).toBe(4)
      expect(notes[0].duration).toBe('q')
    })

    it('parses E4 quarter note', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ notesXml: basicNotesXml }))
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[1].pitch).toBe('E')
      expect(notes[1].octave).toBe(4)
    })

    it('parses G4 quarter note', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ notesXml: basicNotesXml }))
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[2].pitch).toBe('G')
      expect(notes[2].octave).toBe(4)
    })

    it('parses rest', () => {
      const score = MusicXMLAdapter.fromXML(buildMusicXML({ notesXml: basicNotesXml }))
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[3].isRest).toBe(true)
      expect(notes[3].pitch).toBe('R')
    })

    it('parses whole note duration', () => {
      const xml = buildMusicXML({
        notesXml: `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].duration).toBe('w')
    })

    it('parses half note duration', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].duration).toBe('h')
    })

    it('parses eighth note duration', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
          <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].duration).toBe('e')
    })

    it('parses 16th note duration', () => {
      // Use a half note to avoid measure overflow issues with 16th notes
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>16th</type></note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>16th</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].duration).toBe('s')
    })
  })

  describe('accidentals', () => {
    it('maps alter=1 to sharp (#)', () => {
      const xml2 = buildMusicXML({
        notesXml: `
          <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml2)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].accidental).toBe('#')
    })

    it('maps alter=-1 to flat (b)', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].accidental).toBe('b')
    })

    it('maps alter=2 to double-sharp (##)', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><alter>2</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].accidental).toBe('##')
    })

    it('maps alter=-2 to double-flat (bb)', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>B</step><alter>-2</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].accidental).toBe('bb')
    })

    it('no alter → null accidental', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].accidental).toBeNull()
    })
  })

  describe('dotted notes', () => {
    it('marks dotted notes when <dot/> is present', () => {
      const xml = buildMusicXML({
        beats: 3,
        beatType: 4,
        notesXml: `<note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>half</type><dot/></note>`,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].dotted).toBe(true)
    })

    it('non-dotted note has dotted=false', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].dotted).toBe(false)
    })
  })

  describe('tied notes', () => {
    it('marks tied=true when <tied type="start"/> is present', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><tied type="start"/></notations>
          </note>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><tied type="stop"/></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].tied).toBe(true)
      // The stop note is NOT tied (it's the receiving end)
      expect(notes[1].tied).toBe(false)
    })
  })

  describe('fermata', () => {
    it('marks fermata=true when <fermata/> is in <notations>', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><fermata/></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].fermata).toBe(true)
    })

    it('fermata=false when no fermata element', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].fermata).toBe(false)
    })
  })

  describe('lyrics', () => {
    it('extracts lyric text from <lyric><text>', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <lyric><syllabic>single</syllabic><text>hello</text></lyric>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].lyric).toBe('hello')
    })

    it('note without lyric has undefined lyric', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].lyric).toBeUndefined()
    })
  })

  describe('articulations', () => {
    it('maps staccato to articulation="staccato"', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><articulations><staccato/></articulations></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].articulation).toBe('staccato')
    })

    it('maps accent to articulation="accent"', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><articulations><accent/></articulations></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].articulation).toBe('accent')
    })

    it('maps tenuto to articulation="tenuto"', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><articulations><tenuto/></articulations></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].articulation).toBe('tenuto')
    })

    it('maps strong-accent to articulation="marcato"', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><articulations><strong-accent/></articulations></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].articulation).toBe('marcato')
    })
  })

  describe('chords', () => {
    it('marks simultaneous notes as chord=true', () => {
      const xml2 = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml2)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      // First note: not chord
      expect(notes[0].chord).toBe(false)
      // Second and third: chord
      expect(notes[1].chord).toBe(true)
      expect(notes[2].chord).toBe(true)
    })

    it('chord continuation notes have a chordGroup set', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      // The root note (C) is chord=false, chordGroup=undefined
      expect(notes[0].chord).toBe(false)
      expect(notes[0].chordGroup).toBeUndefined()
      // The continuation note (E) is chord=true with a chordGroup
      expect(notes[1].chord).toBe(true)
      expect(notes[1].chordGroup).toBeDefined()
    })
  })

  describe('dynamics', () => {
    it('extracts dynamic from <notations><dynamics>', () => {
      const xml = buildMusicXML({
        notesXml: `
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration><type>quarter</type>
            <notations><dynamics><mf/></dynamics></notations>
          </note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
          <note><rest/><duration>1</duration><type>quarter</type></note>
        `,
      })
      const score = MusicXMLAdapter.fromXML(xml)
      const notes = score.getParts()[0].getVoices()[0].getAllNotes()
      expect(notes[0].dynamic).toBe('mf')
    })
  })

  describe('multi-measure scores', () => {
    it('places notes from multiple measures correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Multi Measure</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`
      const score = MusicXMLAdapter.fromXML(xml)
      const voice = score.getParts()[0].getVoices()[0]
      const measures = voice.getMeasures()
      expect(measures).toHaveLength(2)
      const allNotes = voice.getAllNotes()
      expect(allNotes).toHaveLength(8)
      expect(allNotes[0].pitch).toBe('C')
      expect(allNotes[4].pitch).toBe('G')
      expect(allNotes[7].pitch).toBe('C')
      expect(allNotes[7].octave).toBe(5)
    })
  })

  describe('Song.fromMusicXML', () => {
    it('returns a Song with the correct title and key', async () => {
      // Dynamic import to avoid loading audio adapters in test
      const { Song } = await import('../../../api/Song.js')
      const xml = buildMusicXML({ title: 'XML Song', fifths: 1, tempo: 88 })
      const song = await Song.fromMusicXML(xml)
      const score = song.getScore()
      expect(score.title).toBe('XML Song')
      expect(score.key).toBe('G')
      expect(score.tempo).toBe(88)
    })
  })
})
