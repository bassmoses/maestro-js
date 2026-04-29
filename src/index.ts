// Browser entry — full API including audio

// Primary user-facing API
export { Song } from './api/Song.js'
export type { SongOptions, RenderOptions, PlayOptions, SeekPosition } from './api/Song.js'
export { Voice } from './api/Voice.js'

// Renderer
export { VexFlowAdapter } from './adapters/renderer/VexFlowAdapter.js'
export type { RenderedScore } from './adapters/renderer/VexFlowAdapter.js'
export { findBeamGroups } from './adapters/renderer/BeamGrouper.js'
export { buildStaveLayout, buildScoreLayout } from './adapters/renderer/StaveBuilder.js'
export type { RenderOptions as RendererOptions } from './adapters/renderer/types.js'
export { DEFAULT_RENDER_OPTIONS, THEMES } from './adapters/renderer/types.js'

// Audio
export { ToneAdapter } from './adapters/audio/ToneAdapter.js'
export type {
  PlaybackOptions,
  PlaybackEventType,
  PlaybackEventHandler,
} from './adapters/audio/ToneAdapter.js'
export { getInstrument } from './adapters/audio/instruments/index.js'
export type { InstrumentConfig, InstrumentName } from './adapters/audio/instruments/index.js'

// Internal model (for advanced users)
export { Score } from './model/Score.js'
export { Note } from './model/Note.js'
export { Part } from './model/Part.js'
export { Measure } from './model/Measure.js'
export { VoiceModel } from './model/VoiceModel.js'
export type * from './model/types.js'
export { buildScore } from './model/converter.js'
export { Scheduler } from './scheduler/Scheduler.js'
export type { Timeline, TimelineEvent, NoteEvent, BeatEvent } from './scheduler/timeline.js'
