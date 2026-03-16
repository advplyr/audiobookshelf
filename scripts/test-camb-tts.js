#!/usr/bin/env node

/**
 * Standalone integration test for CAMB AI TTS API.
 * No audiobookshelf imports — uses native fetch only.
 *
 * Usage:
 *   CAMB_API_KEY=xxx node scripts/test-camb-tts.js
 *   node scripts/test-camb-tts.js --api-key=xxx
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const API_BASE = 'https://client.camb.ai/apis'

function getApiKey() {
  const cliArg = process.argv.find((a) => a.startsWith('--api-key='))
  if (cliArg) return cliArg.split('=')[1]
  return process.env.CAMB_API_KEY
}

let passed = 0
let failed = 0

function pass(name) {
  console.log(`  [PASS] ${name}`)
  passed++
}

function fail(name, reason) {
  console.log(`  [FAIL] ${name} — ${reason}`)
  failed++
}

async function testListVoices(apiKey) {
  console.log('\nTest 1: List voices')
  try {
    const res = await fetch(`${API_BASE}/list-voices`, {
      headers: { 'x-api-key': apiKey }
    })
    if (!res.ok) {
      fail('list-voices', `HTTP ${res.status}`)
      return
    }
    const voices = await res.json()
    if (Array.isArray(voices) && voices.length > 0) {
      const firstVoiceId = voices[0].id || voices[0].voice_id
      pass(`list-voices (${voices.length} voices, using id=${firstVoiceId})`)
      return firstVoiceId
    } else {
      fail('list-voices', `Unexpected response: ${JSON.stringify(voices).slice(0, 100)}`)
      return null
    }
  } catch (err) {
    fail('list-voices', err.message)
  }
}

async function testTtsStream(apiKey, voiceId) {
  console.log(`\nTest 2: TTS stream (short text, voice_id=${voiceId})`)
  try {
    const res = await fetch(`${API_BASE}/tts-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        text: 'Hello, this is a test of the CAMB AI text to speech system.',
        voice_id: voiceId,
        language: 'en-us',
        speech_model: 'mars-flash',
        output_configuration: { format: 'wav' }
      })
    })

    if (!res.ok) {
      const body = await res.text()
      fail('tts-stream', `HTTP ${res.status}: ${body.slice(0, 200)}`)
      return
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) {
      fail('tts-stream', `Response too small (${buf.length} bytes)`)
      return
    }

    const tmpFile = path.join(os.tmpdir(), `camb-tts-test-${Date.now()}.wav`)
    fs.writeFileSync(tmpFile, buf)
    pass(`tts-stream (${buf.length} bytes → ${tmpFile})`)
  } catch (err) {
    fail('tts-stream', err.message)
  }
}

async function testInvalidKey() {
  console.log('\nTest 3: Invalid API key')
  try {
    const res = await fetch(`${API_BASE}/list-voices`, {
      headers: { 'x-api-key': 'invalid-key-12345' }
    })
    if (res.ok) {
      fail('invalid-key', 'Expected non-200 but got 200')
    } else {
      pass(`invalid-key (HTTP ${res.status})`)
    }
  } catch (err) {
    fail('invalid-key', err.message)
  }
}

async function main() {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('Error: API key required. Set CAMB_API_KEY env var or use --api-key=KEY')
    process.exit(1)
  }

  console.log('CAMB AI TTS Integration Test')
  console.log('============================')

  const voiceId = await testListVoices(apiKey)
  await testTtsStream(apiKey, voiceId)
  await testInvalidKey()

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
