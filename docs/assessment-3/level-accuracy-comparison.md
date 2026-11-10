# Gemini and Ollama level classification

Both results use `scripts/fixtures/level-labelled.json`, seed 42, and the same 40 held-out rows. The split keeps the first 160 shuffled rows for training and the last 40 for the test. Few-shot examples come from the train rows only. Precision, recall, and F1 are the unweighted means of beginner, intermediate, and advanced on the successfully classified held-out rows.

| Field             | Gemini                  | Ollama     |
| ----------------- | ----------------------- | ---------- |
| Provider          | `gemini`                | `ollama`   |
| Model             | `gemini-3.5-flash-lite` | `llama3.2` |
| Train count       | 160                     | 160        |
| Test count        | 40                      | 40         |
| Classified        | 40                      | 40         |
| Coverage          | 1.000                   | 1.000      |
| Accuracy          | 1.000                   | 1.000      |
| Precision (macro) | 1.000                   | 1.000      |
| Recall (macro)    | 1.000                   | 1.000      |
| F1 (macro)        | 1.000                   | 1.000      |

The Gemini numbers are in `docs/assessment-2/level-accuracy.md`. The Ollama numbers are in `docs/assessment-2/level-accuracy-ollama.md`. Both confusion matrices are 16 beginner, 12 intermediate, and 12 advanced on the diagonal. Macro F1 is above the 0.85 target for both.
