# Note Syntax Reference

Maestro.js uses a concise text notation to represent music. This document covers every feature of the syntax.

---

## Pitches

Notes are specified with a letter name, optional accidental, and an octave number.

```
C4    — middle C
D5    — D in the fifth octave
F#4   — F sharp
Bb3   — B flat
```

### Pitch Names

`C` `D` `E` `F` `G` `A` `B`

### Accidentals

| Symbol | Meaning      |
| ------ | ------------ |
| `#`    | Sharp        |
| `b`    | Flat         |
| `##`   | Double sharp |
| `bb`   | Double flat  |

### Octave

Integer from `0` to `8`. Middle C is `C4`.

---

## Durations

Duration is specified after a colon (`:`).

| Code | Name          | Relative Value |
| ---- | ------------- | -------------- |
| `:w` | Whole         | 4 beats        |
| `:h` | Half          | 2 beats        |
| `:q` | Quarter       | 1 beat         |
| `:e` | Eighth        | ½ beat         |
| `:s` | Sixteenth     | ¼ beat         |
| `:t` | Thirty-second | ⅛ beat         |

If no duration is specified, the default is quarter (`:q`).

### Dotted Notes

Add `.` after the duration code to add half the note's value:

```
G4:h.     — dotted half (3 beats)
C4:q.     — dotted quarter (1.5 beats)
E4:e.     — dotted eighth (¾ beat)
```

---

## Rests

Use `R` as the pitch name:

```
R:q       — quarter rest
R:h       — half rest
R:w       — whole rest
R:e       — eighth rest
```

---

## Chords

Enclose multiple pitches in square brackets. They share a single duration:

```
[C4 E4 G4]:h       — C major triad, half note
[D3 F#3 A3]:q      — D major triad, quarter note
[Bb3 D4 F4 A4]:w   — Bb major 7th, whole note
```

---

## Triplets

Enclose three notes in curly braces. They are squeezed into the duration of one:

```
{C4 D4 E4}:q       — three notes in the space of one quarter
{G4 A4 B4}:h       — three notes in the space of one half
```

---

## Dynamics

Dynamics are specified in parentheses after the duration:

```
C4:q(mf)    — mezzo-forte
D4:h(pp)    — pianissimo
E4:q(fff)   — fortississimo
```

### Available Dynamics

| Code  | Meaning                        |
| ----- | ------------------------------ |
| `ppp` | Pianississimo (extremely soft) |
| `pp`  | Pianissimo (very soft)         |
| `p`   | Piano (soft)                   |
| `mp`  | Mezzo-piano (moderately soft)  |
| `mf`  | Mezzo-forte (moderately loud)  |
| `f`   | Forte (loud)                   |
| `ff`  | Fortissimo (very loud)         |
| `fff` | Fortississimo (extremely loud) |

### Hairpins (Crescendo / Decrescendo)

```
C4:q(p<)    — start crescendo from piano
G4:q(f>)    — start decrescendo from forte
```

---

## Ties

Connect two notes of the same pitch with `~`:

```
C4:h~C4:h          — tied across a beat (sounds like a whole note)
G4:q~G4:q | G4:h   — tie across a barline
```

Tied notes must have the same pitch. The durations are combined in playback.

---

## Slurs

Enclose a phrase in parentheses to indicate a slur (legato phrasing):

```
(E4:q F4:q G4:h)   — slurred phrase
(C4:e D4:e E4:e F4:e G4:h)  — longer slur
```

---

## Fermata

Hold a note longer than its written value (doubles duration in playback):

```
C4:w(fermata)       — fermata on whole note
G4:h(fermata)       — fermata on half note
```

---

## Barlines

Use `|` to separate measures:

```
C4:q D4:q E4:q F4:q | G4:q A4:q B4:q C5:q | C5:w
```

Barlines are required for proper measure layout and bar numbering.

---

## Repeat Markers

### Repeat Section

Use `|:` and `:|` to mark the start and end of a repeated section:

```
|: C4:q D4:q E4:q F4:q :| G4:w
```

This plays the enclosed section twice.

### Da Capo (D.C.)

Replay the entire piece from the beginning:

```
C4:q D4:q E4:q F4:q | G4:h A4:h | D.C.
```

---

## Articulations

Articulations are specified in parentheses, like dynamics:

```
C4:q(staccato)    — short, detached
D4:q(accent)      — emphasized attack
E4:q(tenuto)      — sustained, full value
F4:q(marcato)     — heavily accented
```

| Code       | Meaning             |
| ---------- | ------------------- |
| `staccato` | Short, detached     |
| `accent`   | Emphasized attack   |
| `tenuto`   | Held for full value |
| `marcato`  | Heavily accented    |

Articulations can be combined with other modifiers using multiple parentheses:

```
C4:q(staccato)(mf)    — staccato at mezzo-forte
G4:h(accent)(fermata) — accented fermata
```

---

## Ornaments

Ornaments are also specified in parentheses:

```
C4:q(trill)       — trill
D4:q(mordent)     — mordent
E4:q(turn)        — turn
```

| Code      | Meaning |
| --------- | ------- |
| `trill`   | Trill   |
| `mordent` | Mordent |
| `turn`    | Turn    |

---

## Breath Mark

Insert a brief pause before the next note:

```
C4:q(breath) D4:q   — breath between C and D
```

---

## Grace Notes

A grace note is written with `~` before the main note (not after — that's a tie):

```
~D4 C4:q     — grace note D before quarter C
```

---

## Chord Symbols

Annotate a passage with chord symbol names using `@"..."`:

```
@"Cmaj7" C4:q E4:q G4:q B4:q
@"Am" A3:h C4:h
```

---

## Glissando

Slide from one note to the next using `~>`:

```
C4:q ~> E4:q     — glissando from C to E
```

---

## Rehearsal Marks

Mark sections with letters or numbers in square brackets (without a duration):

```
[A] C4:q D4:q E4:q F4:q
[B] G4:q A4:q B4:q C5:q
```

---

## Expression Text

Freeform expression text is enclosed in curly braces (when it doesn't look like a triplet):

```
{a tempo} C4:q D4:q E4:q F4:q
{soli} G4:h A4:h
```

---

## Navigation Markers

### Dal Segno (D.S.)

Jump back to the Segno marker:

```
Segno C4:q D4:q | E4:q F4:q | D.S.
```

### Segno & Coda

```
Segno C4:q D4:q | E4:q F4:q | Coda G4:w
```

### Fine

Marks the end point when using D.C. or D.S.:

```
C4:q D4:q | Fine | E4:q F4:q | D.C.
```

---

## Volta Endings

First and second endings (and beyond) are marked with `1.`, `2.`, etc. after a barline:

```
|: C4:q D4:q | 1. E4:h :| 2. F4:h
```

---

## Combining Features

All features can be combined freely:

```
[C4 E4 G4]:q(mf) R:q D4:h. | {F4 G4 A4}:q(f) Bb4:h~Bb4:q | C5:w(fermata)
```

This example contains:

- A chord with dynamics
- A rest
- A dotted half note
- A triplet with dynamics
- A tied note across a barline
- A fermata on the final note

---

## Full Grammar

```
note         = pitch duration? modifier* lyric?
pitch        = [A-G] accidental? octave
accidental   = '#' | 'b' | '##' | 'bb'
octave       = [0-8]
duration     = ':' ('w' | 'h' | 'q' | 'e' | 's' | 't') '.'?
modifier     = '(' (dynamic | hairpin | 'fermata' | 'breath' | articulation | ornament) ')'
dynamic      = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'
hairpin      = ('p' | 'mp' | 'mf' | 'f') ('<' | '>')
articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato'
ornament     = 'trill' | 'mordent' | 'turn'
lyric        = '"' text '"'
rest         = 'R' duration?
chord        = '[' note+ ']' duration? modifier*
triplet      = '{' note note note '}' duration? modifier*
tie          = note '~' note
slur         = '(' note+ ')'
graceNote    = '~' pitch
glissando    = '~>'
barline      = '|'
repeat       = '|:' ... ':|'
volta        = [1-9] '.'
dacapo       = 'D.C.'
dalSegno     = 'D.S.'
segno        = 'Segno'
coda         = 'Coda'
fine         = 'Fine'
rehearsal    = '[' (letter | digits) ']'
chordSymbol  = '@"' text '"'
expression   = '{' text '}'
```
