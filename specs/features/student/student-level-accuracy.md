# Course level accuracy

The labelled file and `scripts/level-accuracy.ts` are implemented. An earlier live run scored 0.400 because quota failures were counted as wrong predictions. That figure is not the accuracy under the current rule. Accuracy is correct predictions divided by successfully classified held-out rows. A Gemini API or quota failure is an infrastructure error, is left out of that denominator, and is not stored as a completed prediction. The 0.70 target is met only when accuracy is at least 0.70 and every held-out row was classified. On 21 October 2026 a plan-quota stop left 7 held-out rows uncalled and one infrastructure failure unsaved. On 28 October 2026 the same script resumed the saved predictions and classified the remaining rows. Train count 160. Test count 40. Classified 40. Coverage 1.000. Accuracy 1.000. Classification errors 0. Infrastructure errors 0. Not attempted 0. Invalid replies 0. The confusion matrix is 16 beginner, 12 intermediate, and 12 advanced, all on the diagonal. `docs/assessment-2/level-accuracy.md` records that result and meets the acceptance criterion. See `assessment-2/assessment-2-gap.md`.

Specifies the held-out classification of `courses.level` from title and description. The stored level on a course stays the value the instructor saved. Category prediction is not the target: `category_id` is optional, and the categories migration is not applied. The chat assistant stays in `student-learning-assistant.md`. The RAG corpus stays in `student-rag-corpus.md`.

This feature adds no table, column, policy, screen, or migration. It does not insert rows into `courses`.

## Labelled slice

The slice is a JSON file, `scripts/fixtures/level-labelled.json`, produced before the split. Each row has `id`, `title`, `description`, and `level`. `level` is one of `beginner`, `intermediate`, or `advanced`. The file has at least 200 rows and at least one row of each level. These rows are evaluation text. They are not catalogue courses, enrollments, or `rag_chunks`.

The file is the label source. The classifier does not assign or change those labels. Generating the file may use fixed templates. It must not copy the test rows into the prompt that classifies them.

## Split

Shuffle the file with a seeded PRNG, seed `42`. The last 20 percent, counted with `floor(row count × 0.2)`, is the test set. The earlier rows are the train set. For 200 rows the test set has 40 rows and the train set has 160. A row is in one set only.

## Classifier

A local script, `scripts/level-accuracy.ts`, reads `GEMINI_API_KEY` from the environment for the Gemini provider. It does not read a `VITE_` variable, and it is not called from the browser. The Gemini model is `gemini-3.5-flash-lite`, through the same JSON completion path as `ai-study`, with temperature `0` and a 20-second timeout per call.

The Assessment 3 carry-over adds an Ollama provider on the same labelled file, seed, split, and prompt. The command is `node --experimental-strip-types scripts/level-accuracy.ts --provider ollama`. Ollama must be running at `OLLAMA_HOST` (default `http://127.0.0.1:11434`) with the chat model named by `OLLAMA_LEVEL_MODEL` (default `llama3.2`) already pulled. The call is `POST /api/chat` with JSON output and temperature `0`. A missing model or a connection that still fails after the retry limit stops the run. This command does not call Gemini and does not replace `docs/assessment-2/level-accuracy.md`.

Each pending test row is one call. The prompt contains the title and description of that test row and at most 8 train examples. Include at least one train example of each level when the train set has that level. The prompt contains no test label and no other test row. The reply is JSON `{ "level": "beginner" | "intermediate" | "advanced" }`. A reply that is not one of those three levels is a classification error and stays in the accuracy denominator.

A network error, timeout, HTTP 5xx, or HTTP 429 is an infrastructure failure. Rate-limit 429s and 5xx responses are retried with bounded backoff, at most 4 attempts. A 429 whose body says the plan or billing quota is exhausted is not retried, and the run stops so later rows are not called. Those rows stay not attempted. Infrastructure failures are not incorrect predictions.

Completed predictions are stored in `scripts/fixtures/level-progress.json` as `id`, `predicted`, `provider`, and `model`. A row written before those fields existed is Gemini `gemini-3.5-flash-lite`. A later run skips a saved row only when the provider and model both match the run. A Gemini prediction is not reused for Ollama, and one Ollama model is not reused for another. An infrastructure failure is not written there, so the next run can retry it. The file is local run state and is gitignored.

The script does not update `courses.level`, `category_id`, or course status.

## Evidence

Accuracy is the number of successfully classified test rows whose predicted level equals the file’s level, divided by the number of successfully classified test rows. A row is successfully classified when the model returns a level or an invalid reply. Infrastructure failures and rows that were not attempted are excluded. Coverage is the classified count divided by the test count. For each level, precision is true positives divided by predicted rows of that level, and recall is true positives divided by actual rows of that level among the classified set. An invalid reply counts only against recall for its actual level. F1 is the harmonic mean of that precision and recall. Macro precision, recall, and F1 are the unweighted means of the three levels. A level with no positive cases scores 0 for that metric. If no row is classified, accuracy is not available and the metric scores are 0.

The Gemini bar is accuracy of at least 0.70 and coverage of the full held-out set. The Ollama bar is that Gemini bar plus macro F1 of at least 0.85. A lower result, or a result with any unclassified row, exits with a failure. An incomplete Ollama run does not write `docs/assessment-2/level-accuracy-ollama.md`. A complete Ollama run writes that file even when the F1 target is missed, and the process then exits with a failure. The published Gemini file stays in place unless the command includes `--replace-gemini-report` and the Gemini bar is met.

`docs/assessment-2/level-accuracy.md` is the Gemini baseline: the 28 October result, scored after every held-out row was classified. Coverage is 1.000 and accuracy is 1.000. The Ollama report is separate and names the provider and model. Both reports include:

| Field | Value |
| ----- | ----- |
| Provider | `gemini` or `ollama` |
| Model | The model that produced the predictions |
| Seed | `42` |
| Train count | The train size |
| Test count | The test size |
| Classified | Rows with a model reply |
| Coverage | Classified rows divided by the test count |
| Accuracy | Correct rows divided by classified rows, or `not available` when none were classified |
| Precision (macro) | Unweighted mean of the three precision scores |
| Recall (macro) | Unweighted mean of the three recall scores |
| F1 (macro) | Unweighted mean of the three F1 scores |
| Classification errors | Wrong levels plus invalid replies |
| Infrastructure errors | API, quota, timeout, and network failures after retry |
| Not attempted | Held-out rows left uncalled after a quota or fatal stop |
| Invalid replies | Model replies that are not one of the three levels |

The per-class table lists support, precision, recall, and F1 for `beginner`, `intermediate`, and `advanced`. The confusion matrix uses the same order. Rows are the actual level and columns are the predicted level. The diagonal sum equals the number of correct test rows. The report does not include titles, descriptions, or the API key.

The Dev Control Tower screenshot is taken from this report. The screenshot is not a second source of the number.

## Tests

Vitest covers the split, the accuracy count, per-class and macro metrics, model-specific progress, and an incomplete Ollama run. The model calls are mocked. One fixture check proves a test id is absent from the few-shot examples. The live Ollama run is the script, not a unit test.

## Out of scope

- Writing predictions onto catalogue courses.
- Classifying by category name.
- scikit-learn and a new dependency.
- Replacing the published Gemini baseline during an Ollama run.
- The RAG query report.

## Acceptance criteria

- The labelled file has at least 200 rows, a level on every row, and all three levels.
- No labelled row is inserted into `courses`.
- The seed-42 split puts each row in train or test, with the test size equal to `floor(count × 0.2)`.
- Few-shot examples come from the train split only.
- Held-out accuracy in `docs/assessment-2/level-accuracy.md` is at least 70 percent, and that report’s classified count equals its test count. A partial run does not meet this criterion. The published file is the 28 October Gemini result. A later Gemini run replaces it only when `--replace-gemini-report` is set and the Gemini bar is met.
- The Ollama report covers all 40 held-out rows and records per-class and macro precision, recall, and F1. Macro F1 is at least 0.85. Saved Gemini predictions are not used for that run.
- The confusion matrix uses the three levels and matches that accuracy.
- `courses.level` is unchanged by the script.
- The script does not print the API key.
