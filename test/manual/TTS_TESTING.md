# TTS Integration Manual Testing Guide

## Prerequisites

- A running audiobookshelf instance (dev mode)
- A CAMB AI API key (from https://studio.camb.ai)
- At least one EPUB file imported into a library

## Start Dev Server

```bash
npm run dev
```

Server runs on port 3333 by default.

## Get Auth Token

Either extract from the UI (Settings > Users > API token) or login via API:

```bash
curl -X POST http://localhost:3333/login \
  -H "Content-Type: application/json" \
  -d '{"username": "root", "password": "YOUR_PASSWORD"}'
```

Save the `token` from the response:

```bash
export TOKEN="your-token-here"
export CAMB_API_KEY="your-camb-api-key"
```

## API Endpoints

### GET /api/tts/voices

List available CAMB AI voices.

```bash
curl -s "http://localhost:3333/api/tts/voices?apiKey=$CAMB_API_KEY" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### POST /api/tts/synthesize

Synthesize an ebook to audio. Find your `libraryItemId` from the UI URL or the library items API.

```bash
curl -s -X POST http://localhost:3333/api/tts/synthesize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$CAMB_API_KEY'",
    "libraryItemId": "YOUR_LIBRARY_ITEM_ID",
    "voiceId": "1",
    "language": "en-us",
    "model": "mars-flash"
  }' | jq .
```

## Error Cases to Verify

| Test Case | Expected |
|-----------|----------|
| No `Authorization` header | 401 Unauthorized |
| Non-admin user | 403 Forbidden |
| Missing `apiKey` in body/query | 400 `API key is required` |
| Missing `libraryItemId` | 400 `libraryItemId is required` |
| Missing `voiceId` | 400 `voiceId is required` |
| Non-existent library item ID | 404 `Library item not found` |
| Library item without EPUB | 400 `No EPUB file found for this library item` |
| Invalid CAMB AI API key | 500 with error from CAMB API |
