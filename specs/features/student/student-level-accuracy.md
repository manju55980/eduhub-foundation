# Course level accuracy

The labelled file and `scripts/level-accuracy.ts` are implemented. An earlier live run scored 0.400 because quota failures were counted as wrong predictions. That figure is not the accuracy under the current rule. Accuracy is correct predictions divided by successfully classified held-out rows. A Gemini API or quota failure is an infrastructure error, is left out of that denominator, and is not stored as a completed prediction. The 0.70 target is met only when accuracy is at least 0.70 and every held-out row was classified. On 19 October 2026 the script resumed 16 saved predictions, then stopped on a Gemini plan quota error. Accuracy on those 16 rows is 1.000 and coverage is 0.400. One infrastructure error is recorded, and 23 held-out rows were not called. `docs/assessment-2/level-accuracy.md` records that partial result. It does not meet the acceptance criterion. See `assessment-2-gap.md`.

Specifies the held-out classification of `courses.level` from title and description. The stored level on a course stays the value the instructor saved. Category prediction is not the target: `category_id` is optional, and the categories migration is not applied. The chat assistant stays in `student-learning-assistant.md`. The RAG corpus stays in `student-rag-corpus.md`.

This feature adds no table, column, policy, screen, or migration. It does not insert rows into `courses`.

## Labelled slice

The slice is a JSON file, `scripts/fixtures/level-labelled.json`, produced before the split. Each row has `id`, `title`, `description`, and `level`. `level` is one of `beginner`, `intermediate`, or `advanced`. The file has at least 200 rows and at least one row of each level. These rows are evaluation text. They are not catalogue courses, enrollments, or `rag_chunks`.

The file is the label source. The classifier does not assign or change those labels. Generating the file may use fixed templates. It must not copy the test rows into the prompt that classifies them.

## Split

Shuffle the file with a seeded PRNG, seed `42`. The last 20 percent, counted with `floor(row count × 0.2)`, is the test set. The earlier rows are the train set. For 200 rows the test set has 40 rows and the train set has 160. A row is in one set only.

## Classifier

A local script, `scripts/level-accuracy.ts`, reads `GEMINI_API_KEY` from the environment. It does not read a `VITE_` variable, and it is not called from the browser. The model is `gemini-3.5-flash-lite`, through the same JSON completion path as `ai-study`, with temperature `0` and a 20-second timeout per call.

Each pending test row is one call. The prompt contains the title and description of that test row and at most 8 train examples. Include at least one train example of each level when the train set has that level. The prompt contains no test label and no other test row. The reply is JSON `{ "level": "beginner" | "intermediate" | "advanced" }`. A reply that is not one of those three levels is a classification error and stays in the accuracy denominator.

A network error, timeout, HTTP 5xx, or HTTP 429 is an infrastructure failure. Rate-limit 429s and 5xx responses are retried with bounded backoff, at most 4 attempts. A 429 whose body says the plan or billing quota is exhausted is not retried, and the run stops so later rows are not called. Those rows stay not attempted. Infrastructure failures are not incorrect predictions.

Completed predictions are stored in `scripts/fixtures/level-progress.json` as `id` and `predicted` only. A later run skips those ids. An infrastructure failure is not written there, so the next run can retry it. The file is local run state and is gitignored.

The script does not update `courses.level`, `category_id`, or course status.

## Evidence

Accuracy is the number of successfully classified test rows whose predicted level equals the file’s level, divided by the number of successfully classified test rows. A row is successfully classified when the model returns a level or an invalid reply. Infrastructure failures and rows that were not attempted are excluded. Coverage is the classified count divided by the test count. The run meets the bar only when accuracy is at least 0.70 and coverage is the full held-out set. A lower result, or a result with any unclassified row, exits with a failure and does not replace a previous passing report. If no row is classified, accuracy is not available.

The script replaces `docs/assessment-2/level-accuracy.md` only when the bar is met. The current file is the 19 October partial result, scored from the saved predictions after the quota stop. It includes:

| Field | Value |
| ----- | ----- |
| Model | `gemini-3.5-flash-lite` |
| Seed | `42` |
| Train count | The train size |
| Test count | The test size |
| Classified | Rows with a model reply |
| Coverage | Classified rows divided by the test count |
| Accuracy | Correct rows divided by classified rows, or `not available` when none were classified |
| Classification errors | Wrong levels plus invalid replies |
| Infrastructure errors | API, quota, timeout, and network failures after retry |
| Not attempted | Held-out rows left uncalled after a quota or fatal stop |
| Invalid replies | Model replies that are not one of the three levels |

The confusion matrix is a table. Rows are the actual level and columns are the predicted level, in the order `beginner`, `intermediate`, `advanced`. The diagonal sum equals the number of correct test rows. The report does not include titles, descriptions, or the API key.

The Dev Control Tower screenshot is taken from this report. The screenshot is not a second source of the number.

## Tests

Vitest covers the split and the accuracy count with the model mocked. One fixture check proves a test id is absent from the few-shot examples. The live Gemini run is the script, not a unit test.

## Out of scope

- Writing predictions onto catalogue courses.
- Classifying by category name.
- scikit-learn, a new dependency, and Ollama.
- The RAG query report.

## Acceptance criteria

- The labelled file has at least 200 rows, a level on every row, and all three levels.
- No labelled row is inserted into `courses`.
- The seed-42 split puts each row in train or test, with the test size equal to `floor(count × 0.2)`.
- Few-shot examples come from the train split only.
- Held-out accuracy in `docs/assessment-2/level-accuracy.md` is at least 70 percent, and that report’s classified count equals its test count. A partial run does not meet this criterion.
- The confusion matrix uses the three levels and matches that accuracy.
- `courses.level` is unchanged by the script.
- The script does not print the API key.
