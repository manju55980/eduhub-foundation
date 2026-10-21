# RAG evaluation

Specifies the matching, extreme, and noisy retrieval report for `rag_chunks`. The corpus, embeddings, and `match_knowledge` stay in `student-rag-corpus.md`. This report is the Assessment 2 retrieval evidence. It is not the admin Reports screen, and it does not add dashboard counts or charts.

This feature adds no table, column, policy, screen, or migration. `scripts/fixtures/rag-queries.json` and `scripts/rag-evaluation.ts` wrote `docs/assessment-2/rag-evaluation.md` for the 676 embedded chunks stored on 21 October 2026. That corpus does not meet the 5,000 FAQ requirement. See `assessment-2-gap.md`.

## Query sets

The fixture is `scripts/fixtures/rag-queries.json`. Each row has `id`, `set`, `query`, `expected_source_keys`, and, for a noisy row, `pair_id`.

| Set | Size | Expected keys | Query |
| --- | ---- | ------------- | ----- |
| `matching` | 30 | One or more `source_key` values the RAG seed writes. FAQ keys and published course keys only. | A clean paraphrase of that chunk. |
| `noisy` | 30 | The same keys as the matching row with this `pair_id`. | The paired wording plus at least one misspelling and one junk token. |
| `extreme` | 30 | 15 rows name a short keyword’s expected key. 15 rows use an empty key list. | A very short query, or an out-of-corpus question that does not copy a stored chunk. |

Every noisy row pairs with one matching row. Expected keys for matching and noisy rows exist after the seed in `student-rag-corpus.md`. They are not draft course keys and not lesson keys for a course the catalogue hides. The fixture is stored text, so a second run uses the same queries.

## How retrieval is scored

The script `scripts/rag-evaluation.ts` embeds each query with `gemini-embedding-001` at 768 dimensions, L2-normalized, task type `RETRIEVAL_QUERY`, as specified in `student-rag-corpus.md`, and calls `match_knowledge`. It uses the catalogue visibility from `student-rag-corpus.md`: FAQ chunks and published course chunks. It does not score draft chunks or lesson chunks. It does not use the service-role client to bypass RLS. `GEMINI_API_KEY` comes from the environment, not from a `VITE_` name, and is not printed.

`match_knowledge` may return up to 10 rows. The metrics use the first 5.

| Metric | Definition |
| ------ | ---------- |
| Hit@5 | Among queries that have at least one expected key, the share whose top 5 include one of those keys. |
| MRR@5 | The mean of `1 / rank` for the first expected key in the top 5, or `0` when it is absent. Same denominator as Hit@5. |
| Mean top-1 cosine | The mean cosine similarity of the first returned row. A query with no row contributes `0`. |
| Extreme rejection | Among the 15 extreme queries with an empty key list, the share whose top row is missing or has cosine similarity below `0.75`. |
| Noise delta | Hit@5 of `matching` minus Hit@5 of `noisy`, on the 30 pairs. |

Whitespace-only queries are not part of the fixture. The assistant rejects a blank chat message separately.

## Report

The script writes `docs/assessment-2/rag-evaluation.md`. The report has one table:

| Set | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| --- | ------: | ----: | ----: | ----------------: |
| Matching | 30 |  |  |  |
| Noisy | 30 |  |  |  |
| Extreme, with an expected key | 15 |  |  |  |
| Extreme, out of corpus | 15 | — | — | Mean top-1 cosine |

Hit@5 and MRR@5 stay blank for the out-of-corpus row. The report states the extreme rejection rate under the table, at cosine 0.75, with that set’s mean top-1 cosine. The report also states the noise delta as a fraction. A positive delta means the clean set hit more often than the noisy set.

The report names `gemini-embedding-001`, 768 dimensions, and cosine distance. It does not include chunk bodies or the API key. The Dev Control Tower screenshot is taken from this table.

## Tests

Vitest covers Hit@5, MRR@5, the noise delta, and extreme rejection with embeddings and `match_knowledge` mocked. One case shows a lesson `source_key` is not an accepted expected key. The live retrieval run is the script, not a unit test.

## Out of scope

- Changing `match_knowledge`, the student select policy, or the seed size.
- The learning-assistant chat and the level classifier.
- Admin Reports.

## Acceptance criteria

- The fixture has 30 matching queries, 30 paired noisy queries, and 30 extreme queries, 15 of them with an empty expected list.
- Expected keys are FAQ or published course keys from the seed.
- The report states Hit@5, MRR@5, and mean top-1 cosine for the sets that have expected keys.
- The report states extreme rejection at cosine `0.75` and the matching-versus-noisy Hit@5 delta.
- The scored retrieval does not include draft or hidden lesson chunks and does not bypass RLS.
- The script does not print the API key.
