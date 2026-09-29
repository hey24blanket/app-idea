# Live SajuGrap RAG connection

Blanket reads the existing SajuGrap Firestore through `POST /api/blanket-rag` on the SajuGrap server. Firebase credentials stay on that server. No new Firebase project or ChunkingExpress browser session is required.

## Trust and ownership

Authenticated, invitation-only Blanket accounts can request the shared knowledge corpus. User profiles, exploration selections, pitches and conversations remain account-scoped. The server signs a body-bound Ed25519 assertion lasting 60 seconds with issuer, audience, scope and authenticated subject. The private signing key is in the existing private data repository at `integrations/sajugrap-signing.json`; never return it to clients or commit it to a public repository. SajuGrap pins only the public key. Rotation requires updating that pinned public key alongside the private signing key. The public-key endpoint returns only the public JWK; preview deployment protection remains enabled.

The endpoint cannot import, edit, promote or delete Firebase data. Unsigned requests return 401. The knowledge corpus sent as evidence is untrusted data in the council prompt.

## Inventory and retrieval

Use the active runtime version, or unversioned legacy documents if no active version exists. Apply the existing retrievability policy and exclude non-production corpora. Inventory is bounded to 5,000 documents and cached for up to five minutes in the server process. Exceeding the bound reports unavailable instead of a partial count. The displayed timestamp is the actual inventory snapshot time.

Counts distinguish chunks, unique explicit knowledge IDs, and chunks without knowledge IDs. No unique-knowledge count is inferred from chunk count. Category strings and explicit category objects are read from Firebase metadata. Slash-separated paths retain their hierarchy; missing metadata stays unclassified. No CE planned taxonomy is shown as existing knowledge. Button color represents chunk volume; outline/check represents navigation/selection.

Query embeddings use SajuGrap's existing Gemini embedding configuration. For this small corpus cosine ranking is calculated against loaded Firestore vectors, with category filters and one result per explicit knowledge ID, maximum six evidence records. This avoids introducing another vector index. A larger corpus needs paginated aggregation and indexed filtered retrieval before increasing the inventory bound. The search test checks actual query embedding and evidence return, separately from a successful Firestore read.

New council runs retrieve current RAG evidence. Daily exploration rotates less-used available categories; confirmed conversational concepts query their actual brief. A RAG error or empty eligible result stops the run instead of silently claiming RAG grounding. Existing published pitches and draft conversations are not regenerated.

## Verification

26 Blanket tests and 4 SajuGrap tests passed. Live check on 2026-09-29: 228 active chunks, 228 vectors; semantic search returned stored documents including relationship structure and action-first interpretation. This corpus is predominantly Saju knowledge; it does not establish broad coverage of film, parenting or software.
