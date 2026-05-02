// Node entry — sheet rendering + SVG/PNG export, no Web Audio

// Primary user-facing API
export { Song } from '../api/Song.js'
export type { SongOptions, RenderOptions, PlayOptions, SeekPosition } from '../api/Song.js'
export { Voice } from '../api/Voice.js'

// Renderer (SVG export works in Node with jsdom)
export { VexFlowAdapter, releaseJsdom } from '../adapters/renderer/VexFlowAdapter.js'
export type { RenderedScore } from '../adapters/renderer/VexFlowAdapter.js'
export { findBeamGroups } from '../adapters/renderer/BeamGrouper.js'
export { buildStaveLayout, buildScoreLayout } from '../adapters/renderer/StaveBuilder.js'
export type { RenderOptions as RendererOptions } from '../adapters/renderer/types.js'
export { DEFAULT_RENDER_OPTIONS, THEMES } from '../adapters/renderer/types.js'

// Internal model (for advanced users)
export { Score } from '../model/Score.js'
export { Note } from '../model/Note.js'
export { Part } from '../model/Part.js'
export { Measure } from '../model/Measure.js'
export { VoiceModel } from '../model/VoiceModel.js'
export type * from '../model/types.js'
export { buildScore, nodeToNote } from '../model/converter.js'
export { Scheduler } from '../scheduler/Scheduler.js'
export type { Timeline, TimelineEvent, NoteEvent, BeatEvent } from '../scheduler/timeline.js'

// MIDI export
export { MIDIAdapter } from '../adapters/export/MIDIAdapter.js'

// ScoreJSON export/import
export { ScoreJSONAdapter } from '../adapters/export/ScoreJSONAdapter.js'
export type { ScoreJSON } from '../adapters/export/ScoreJSONAdapter.js'

// MusicXML import
export { MusicXMLAdapter } from '../adapters/import/MusicXMLAdapter.js'
