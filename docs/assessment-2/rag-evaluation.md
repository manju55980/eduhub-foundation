# RAG evaluation

Retrieval used `gemini-embedding-001` at 768 dimensions with cosine distance. Each query used task type `RETRIEVAL_QUERY`. `match_knowledge` ran as an authenticated student, so the existing select policy kept draft chunks and unenrolled lesson chunks out of the scored rows. Metrics use the first 5 rows.

| Set | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| --- | ---: | ---: | ---: | ---: |
| Matching | 30 | 1.000 | 1.000 | 0.844 |
| Noisy | 30 | 1.000 | 1.000 | 0.807 |
| Extreme, with an expected key | 15 | 1.000 | 0.649 | 0.738 |
| Extreme, out of corpus | 15 | — | — | 0.537 |

Extreme rejection at cosine 0.75: 1.000. This is the share of the 15 out-of-corpus queries whose top row is missing or whose cosine similarity is below 0.75. It is not Hit@5 or MRR@5, because those queries have no expected key. Their mean top-1 cosine is 0.537.

Noise delta (matching Hit@5 minus noisy Hit@5): 0.000. A positive delta means the clean set hit more often than the noisy set.

The scored corpus has 300 embedded chunks. Later seeds stored 572 chunks (6 course, 13 lesson, and 553 FAQ) and stopped on the Gemini plan quota. This report was not re-run, so these metrics do not cover the later rows. The 5,000 FAQ record requirement is not met.
