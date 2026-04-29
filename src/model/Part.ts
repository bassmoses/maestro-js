import { VoiceModel, Clef } from './Voice.js'

export class Part {
  readonly name: string
  private voices: Map<string, VoiceModel>

  constructor(name: string) {
    this.name = name
    this.voices = new Map()
  }

  addVoice(name: string, clef: Clef): VoiceModel {
    const voice = new VoiceModel(name, clef)
    this.voices.set(name, voice)
    return voice
  }

  getVoice(name: string): VoiceModel | undefined {
    return this.voices.get(name)
  }

  getVoices(): readonly VoiceModel[] {
    return Array.from(this.voices.values())
  }
}
