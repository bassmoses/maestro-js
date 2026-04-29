import { VoiceModel, Clef } from './VoiceModel.js'

export class Part {
  readonly name: string
  private voices: Map<string, VoiceModel>

  constructor(name: string) {
    this.name = name
    this.voices = new Map()
  }

  addVoice(name: string, clef: Clef): VoiceModel {
    if (this.voices.has(name)) {
      throw new Error(`Voice "${name}" already exists in part "${this.name}"`)
    }
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
