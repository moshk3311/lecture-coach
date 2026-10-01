// Chromium plays a WAV file as the microphone (--use-file-for-fake-audio-capture) and loops it.
const fs = require('fs')
const path = require('path')

const RATE = 48000

/** Writes a 4-second "speech-like" loop (tone bursts and pauses) into `dir` and returns its path. */
function fakeMicFile(dir) {
  const file = path.join(dir, 'fake-mic.wav')
  if (fs.existsSync(file)) return file
  const samples = new Int16Array(RATE * 4)
  for (let i = 0; i < samples.length; i++) {
    const t = i / RATE
    const voiced = t % 0.5 < 0.3 // 300 ms of sound, 200 ms of silence
    const tone = Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t)
    samples[i] = voiced ? Math.round(tone * 0.3 * 32767) : 0
  }
  const data = Buffer.from(samples.buffer)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([header, data]))
  return file
}

module.exports = { fakeMicFile }
