import type * as SpeechSdk from 'microsoft-cognitiveservices-speech-sdk'
import { buildSsml } from '../../speech/ssml'
import { SpeechServiceError, getAzureToken } from '../../speech/tokenClient'
import type { SpeechProvider, WordTiming } from '../speech'

const LOCALE = 'en-US'
/** Azure reports offsets and durations in 100-ns ticks. */
const TICKS_PER_MS = 10_000

let sdkPromise: Promise<typeof SpeechSdk> | null = null

/** The Speech SDK is large; load it only when speech is actually used. */
function loadSdk(): Promise<typeof SpeechSdk> {
  sdkPromise ??= import('microsoft-cognitiveservices-speech-sdk')
  return sdkPromise
}

export const azureSpeechProvider: SpeechProvider = {
  async synthesize({ text, voice, rate, format }) {
    const [sdk, { token, region }] = await Promise.all([loadSdk(), getAzureToken()])
    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region)
    config.speechSynthesisVoiceName = voice
    config.speechSynthesisOutputFormat =
      format === 'mp3'
        ? sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
        : sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm

    // audioConfig = null keeps the audio in memory (result.audioData) instead of playing it.
    const synthesizer = new sdk.SpeechSynthesizer(config, null)
    const wordTimings: WordTiming[] = []
    synthesizer.wordBoundary = (_sender, event) => {
      if (event.boundaryType !== sdk.SpeechSynthesisBoundaryType.Word) return
      wordTimings.push({
        word: event.text,
        offsetMs: event.audioOffset / TICKS_PER_MS,
        durationMs: event.duration / TICKS_PER_MS,
      })
    }

    try {
      const result = await new Promise<SpeechSdk.SpeechSynthesisResult>((resolve, reject) => {
        synthesizer.speakSsmlAsync(buildSsml({ text, voice, rate, locale: LOCALE }), resolve, reject)
      })
      if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
        throw new SpeechServiceError(`הסינתזה נכשלה: ${result.errorDetails || 'סיבה לא ידועה'}`)
      }
      return {
        audio: result.audioData,
        mimeType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        wordTimings,
      }
    } finally {
      synthesizer.close()
    }
  },

  async assessOnce({ pcm, referenceText }) {
    const [sdk, { token, region }] = await Promise.all([loadSdk(), getAzureToken()])
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
    speechConfig.speechRecognitionLanguage = LOCALE

    const stream = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1))
    stream.write(pcm)
    stream.close()

    const recognizer = new sdk.SpeechRecognizer(speechConfig, sdk.AudioConfig.fromStreamInput(stream))
    const assessment = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true, // enableMiscue
    )
    assessment.enableProsodyAssessment = true
    assessment.phonemeAlphabet = 'IPA'
    assessment.nbestPhonemeCount = 5
    assessment.applyTo(recognizer)

    try {
      const result = await new Promise<SpeechSdk.SpeechRecognitionResult>((resolve, reject) => {
        recognizer.recognizeOnceAsync(resolve, reject)
      })
      if (result.reason === sdk.ResultReason.Canceled) {
        const details = sdk.CancellationDetails.fromResult(result)
        throw new SpeechServiceError(`Azure ביטל את ההערכה: ${details.errorDetails || sdk.CancellationReason[details.reason]}`)
      }
      if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
        throw new SpeechServiceError('Azure לא זיהה דיבור בהקלטה.')
      }
      const json = result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)
      return { recognizedText: result.text, raw: JSON.parse(json) as unknown }
    } finally {
      recognizer.close()
    }
  },
}
