# Hybrid retrieval

Same 90 queries as `docs/assessment-2/rag-evaluation.md`. Vector is the first 5 rows from `match_knowledge`. Hybrid is the first 5 rows after the rank merge with `search_knowledge_text`.

Faithfulness and answer relevance use an answer copied from the retrieved text. They are lexical stand-ins, not a model judge. Context precision is the average precision of the expected key inside the top 5.

| Set      | Queries | Vector Hit@5 | Hybrid Hit@5 | Vector MRR@5 | Hybrid MRR@5 | Vector precision | Hybrid precision | Vector faithfulness | Hybrid faithfulness | Vector relevance | Hybrid relevance |
| -------- | ------: | -----------: | -----------: | -----------: | -----------: | ---------------: | ---------------: | ------------------: | ------------------: | ---------------: | ---------------: |
| Matching |      30 |        1.000 |        0.833 |        0.950 |        0.387 |            0.950 |            0.387 |               1.000 |               1.000 |            0.625 |            0.465 |
| Noisy    |      30 |        0.867 |        0.433 |        0.291 |        0.200 |            0.291 |            0.200 |               1.000 |               1.000 |            0.282 |            0.329 |
| Extreme  |      30 |        0.133 |        0.067 |        0.080 |        0.022 |            0.080 |            0.022 |               1.000 |               1.000 |            0.527 |            0.551 |
| All      |      90 |        0.773 |        0.520 |        0.512 |        0.239 |            0.512 |            0.239 |               1.000 |               1.000 |            0.478 |            0.448 |
