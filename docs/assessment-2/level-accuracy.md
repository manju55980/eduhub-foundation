# Course level accuracy

This report scores the saved predictions from the 21 October 2026 run. The script resumed the 16 predictions saved on 19 October, classified 16 more held-out rows, then Gemini returned a plan quota error. That quota call was not repeated. The 32 completed predictions stay in `scripts/fixtures/level-progress.json`. The 0.70 target is not met: accuracy is 1.000 on the classified rows, and coverage is 0.800 because 7 held-out rows were not called.

| Field | Value |
| ----- | ----- |
| Model | `gemini-3.5-flash-lite` |
| Seed | 42 |
| Train count | 160 |
| Test count | 40 |
| Classified | 32 |
| Coverage | 0.800 (80.0%) |
| Accuracy | 1.000 (100.0%) |
| Classification errors | 0 |
| Infrastructure errors | 1 |
| Not attempted | 7 |
| Invalid replies | 0 |

## Confusion matrix

Rows are the actual level. Columns are the predicted level. Accuracy uses only successfully classified held-out rows. The quota failure and the 7 uncalled rows are outside this matrix.

| Actual \ Predicted | beginner | intermediate | advanced |
| ------------------- | -------- | ------------ | -------- |
| beginner | 13 | 0 | 0 |
| intermediate | 0 | 10 | 0 |
| advanced | 0 | 0 | 9 |
