# Maestro.js — Improvements

## Completed

### ✅ Lyrics Support

- Parser syntax: `C4:q"hello"` attaches lyric to a note
- Works with chords: `[C4 E4 G4]:q"word"` (lyric on first note)
- VexFlow renderer displays lyrics as annotations below staves
- Files: parser (tokenizer, parser), model (Note, converter, VoiceModel), renderer (VexFlowAdapter)
- Tests: `src/parser/__tests__/lyrics.test.ts` (12 tests)

### ✅ ScoreJSON Format

- `ScoreJSONAdapter.toJSON(score)` / `ScoreJSONAdapter.fromJSON(json)` for portable JSON import/export
- Handles all note properties: lyrics, dynamics, ties, chords, fermata, triplets, tempo changes, repeats
- Song API: `song.exportScoreJSON()` and `Song.fromScoreJSON(json)`
- Files: `src/adapters/export/ScoreJSONAdapter.ts`
- Tests: `src/adapters/export/__tests__/ScoreJSONAdapter.test.ts` (9 tests)

### ✅ Loop Support

- `Score.setLoop(start, end)` / `Score.clearLoop()` / `Score.getLoop()`
- `Song.loop(start, end)` / `Song.clearLoop()` API methods
- ToneAdapter configures Tone.js transport looping automatically
- Tests: `src/scheduler/__tests__/loop.test.ts` (5 tests)

### ✅ UMD Bundle

- Single `<script>` tag: bundles VexFlow, Tone.js, and midi-writer-js inline
- Outputs: `dist/maestro.umd.js` and `dist/maestro.umd.min.js`
- Configured in `rollup.config.ts` with resolve, commonjs, json, and terser plugins

## Out of Scope (No Changes Needed)

- Non-score audio pipelines (e.g. expo-audio) are independent of maestro-js
- WebView architecture is inherent to Tone.js + VexFlow requiring a browser context
