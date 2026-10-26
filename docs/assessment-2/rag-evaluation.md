# RAG evaluation

Retrieval used `nomic-embed-text` at 768 dimensions with cosine distance. Documents are prefixed with `search_document:` and queries with `search_query:`. `match_knowledge` ran as an authenticated student, so the existing select policy kept draft chunks and unenrolled lesson chunks out of the scored rows. Metrics use the first 5 rows.

| Set | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| --- | ---: | ---: | ---: | ---: |
| Matching | 30 | 1.000 | 0.950 | 0.888 |
| Noisy | 30 | 0.867 | 0.291 | 0.841 |
| Extreme, with an expected key | 15 | 0.133 | 0.080 | 0.820 |
| Extreme, out of corpus | 15 | — | — | 0.493 |

Extreme rejection at cosine 0.75: 1.000. This is the share of the 15 out-of-corpus queries whose top row is missing or whose cosine similarity is below 0.75. It is not Hit@5 or MRR@5, because those queries have no expected key. Their mean top-1 cosine is 0.493.

Noise delta (matching Hit@5 minus noisy Hit@5): 0.133. A positive delta means the clean set hit more often than the noisy set.

The scored corpus has 5040 embedded chunks. The 5,000 FAQ record requirement is met.

Those 5,040 chunks are 9 course, 31 lesson, and 5,000 FAQ. The count was taken on 26 October 2026 after the in-place upsert. Embeddings are Ollama `nomic-embed-text` at 768 dimensions. The table above is that run. It was not recomputed for this note.

Deployed catalogue search uses the same model. `ai-agent` reads `OLLAMA_HOST`. On 26 October that secret was an account-less Cloudflare quick tunnel to a local proxy. The proxy accepts only `POST /api/embed` for `nomic-embed-text` and forwards it to Ollama on `127.0.0.1:11434`. The tunnel URL is not stored in this repository. Cloudflare does not guarantee that tunnel. If Ollama, the proxy, or the tunnel stops, `search_catalogue` cannot embed a query. The queries in this report were embedded on the machine that ran the script, not through that tunnel. This table used the approximate HNSW order. `supabase/migrations/20261027004700_match_knowledge_exact_search.sql` was applied manually afterward. It sorts the stored vectors exactly and does not change these rows. This table was not recomputed.
