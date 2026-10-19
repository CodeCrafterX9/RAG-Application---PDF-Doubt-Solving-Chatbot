# Marginalia — PDF Q&A frontend

A frontend for a RAG app: upload one or more PDFs, watch them get indexed, then ask
questions and get answers with clickable page citations. Plain HTML/CSS/JS —
no build step, no framework. Open `index.html` in a browser and it works out of
the box against fake data (`MOCK_MODE = true` in `app.js`).

## Files

- `index.html` — structure
- `styles.css` — the whole design system (see comments at the top for the color/type tokens)
- `app.js` — state + rendering, and the `Api` object your backend plugs into

-- 
code to start 
python -m http.server 8000
http://localhost:8000/frontend/
--

## Wiring up your backend

Everything you need to change lives at the top of `app.js`:

```js
const CONFIG = {
  MOCK_MODE: true,              // set to false
  API_BASE_URL: "http://localhost:8000", // point at your backend
};
```

Then implement these four endpoints. Each one is documented in detail right above
its function in the `Api` object in `app.js`.

### `POST /documents`
Upload one or more PDFs (`multipart/form-data`, repeatable field `files`).

Response:
```json
[
  { "id": "doc_123", "filename": "paper.pdf", "pages": 12, "status": "processing" }
]
```
`status` is one of `"processing" | "ready" | "error"`. If you index synchronously,
just return `"ready"` immediately and the frontend won't bother polling.

### `GET /documents/{id}/status`
Used to poll while a doc is `"processing"`.

Response:
```json
{ "id": "doc_123", "status": "ready", "pages": 12 }
```

### `DELETE /documents/{id}`
Removes a document from the index. No response body required.

### `POST /chat`
The actual RAG query.

Request:
```json
{
  "question": "What's the refund policy?",
  "document_ids": ["doc_123"],
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
`document_ids` is `null` when the user has "All documents" selected — search
everything that's `ready`. `history` is prior turns in the current conversation,
in case you want to support follow-up questions.

Response:
```json
{
  "answer": "The refund window is 30 days from purchase.",
  "citations": [
    {
      "document_id": "doc_123",
      "filename": "policy.pdf",
      "page": 4,
      "snippet": "Refunds are honored within 30 days of purchase..."
    }
  ]
}
```
`citations` is what powers the little page-number tabs under each answer — click
one and it opens a drawer showing the filename, page, and snippet. If your
backend doesn't return snippets, the drawer still works, it just says so.

## Streaming (optional)

If you want token-by-token streaming instead of waiting for the full answer,
replace `Api.ask` with an `EventSource` or `fetch` + `ReadableStream` implementation.
There's a comment marking the exact spot in `sendQuestion()` (in `app.js`) where you'd
update the message incrementally instead of waiting for one final response.

## Notes

- CORS: your backend will need to allow requests from wherever this frontend is
  served (`Access-Control-Allow-Origin`), since they'll likely be on different
  origins/ports during development.
- File size limits: there's no client-side cap on PDF size right now — add one in
  `handleFiles()` in `app.js` if your backend has a limit, so users get instant
  feedback instead of a failed upload.
- The whole thing is single-user / single-session — there's no auth and no
  persistence between page reloads. If you need either, that's backend + a bit
  of localStorage/session wiring on top of this.
