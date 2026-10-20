# Course level accuracy

This report scores the saved predictions from the 19 October 2026 run. Gemini returned a plan quota error on the next held-out row, and that call was not repeated. The 16 completed predictions stay in `scripts/fixtures/level-progress.json`. The 0.70 target is not met: accuracy is 1.000 on the classified rows, and coverage is 0.400 because 23 held-out rows were not called.

| Field | Value |
| ----- | ----- |
| Model | `gemini-3.5-flash-lite` |
| Seed | 42 |
| Train count | 160 |
| Test count | 40 |
| Classified | 16 |
| Coverage | 0.400 (40.0%) |
| Accuracy | 1.000 (100.0%) |
| Classification errors | 0 |
| Infrastructure errors | 1 |
| Not attempted | 23 |
| Invalid replies | 0 |

## Confusion matrix

Rows are the actual level. Columns are the predicted level. Accuracy uses only successfully classified held-out rows. The quota failure and the 23 uncalled rows are outside this matrix.

| Actual \ Predicted | beginner | intermediate | advanced |
| ------------------- | -------- | ------------ | -------- |
| beginner | 4 | 0 | 0 |
| intermediate | 0 | 8 | 0 |
| advanced | 0 | 0 | 4 |
