# Hybrid retrieval

Specifies vector plus keyword search, a rank merge, and a repeatable scorecard beside the Assessment 2 baseline. The corpus and `match_knowledge` stay in `student-rag-corpus.md`. The baseline report stays in `docs/assessment-2/rag-evaluation.md`. The course tutor and the learning assistant call this search after the score script uses it.

This feature adds `public.search_knowledge_text` in `supabase/migrations/20261125120000_hybrid_knowledge_search.sql`. It adds no table and no column. It does not replace `match_knowledge`.

## Search

`search_knowledge_text` is `security invoker`. The existing `rag_chunks` select policy still applies. The function reads `title` and `body` with English full text. A blank query returns no rows. It returns at most 10 rows.

The shared merge is `fuseChunks` in `supabase/functions/_shared/hybrid-search.ts`.

1. Take up to 10 vector rows from `match_knowledge` and up to 10 text rows from `search_knowledge_text`.
2. Give each row `1 / (60 + rank)`. Rank starts at 1. A row in both lists keeps both scores.
3. A row in both lists that also contains a query word of 3 or more characters gets `0.02` for each shared word, at most 5 words.
4. Sort by that score, then by id.

The keyword query sent to the text function is those words joined by `or`, at most 8 words. A text-search error leaves the vector list in place. A vector error stops the search.

The course tutor filters the merged rows to this course’s chunks and FAQ chunks, then keeps 5. The learning-assistant catalogue search keeps the first 5 merged rows and does not filter to one course.

## Scores

`scripts/hybrid-rag-evaluation.ts` uses the same 90 queries as `scripts/fixtures/rag-queries.json`. It embeds them with local Ollama, calls both functions as a student, and writes `docs/assessment-4/hybrid-rag.md`. It does not overwrite the Assessment 2 report.

Hit@5 and MRR@5 use the same definitions as `student-rag-evaluation.md`, once for the vector list and once for the merged list.

The other three scores are lexical stand-ins for a RAGAS judge. They do not call Gemini.

| Score             | Definition                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context precision | For a query with an expected key, the average of `relevant so far / rank` at each relevant row in the top 5. A query with no expected key is left out.                                               |
| Faithfulness      | The answer is the context sentences that share a query word, or the first two sentences when none do. A sentence is supported when every word of 4 or more characters appears in the retrieved text. |
| Answer relevance  | The share of query words of 4 or more characters that also appear in that answer.                                                                                                                    |

The answer is copied from the retrieved text, so faithfulness stays high when the top row has text. The comparison that can move is Hit@5, MRR@5, and context precision.

## Out of scope

- A new embedding model, a cross-encoder, or a Gemini re-ranker.
- Changing the stored 768-dimension vectors.
- The CI gate. That stays in the Assessment 4 brief until a threshold is chosen.
