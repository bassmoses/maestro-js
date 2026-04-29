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
note     = pitch duration? dynamic?
pitch    = [A-G] accidental? octave
accidental = '#' | 'b' | '##' | 'bb'
octave   = [0-8]
duration = ':' ('w' | 'h' | 'q' | 'e' | 's' | 't') '.'?
dynamic  = '(' ('pp'|'p'|'mp'|'mf'|'f'|'ff'|'fff'|'p<'|'f>'|'fermata') ')'
rest     = 'R' duration?
chord    = '[' note+ ']' duration? dynamic?
triplet  = '{' note note note '}' duration? dynamic?
tie      = note '~' note
slur     = '(' note+ ')'
barline  = '|'
repeat   = '|:' ... ':|'
dacapo   = 'D.C.'
```
