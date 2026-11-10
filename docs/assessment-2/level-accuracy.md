# Course level accuracy

| Field                 | Value                   |
| --------------------- | ----------------------- |
| Provider              | `gemini`                |
| Model                 | `gemini-3.5-flash-lite` |
| Seed                  | 42                      |
| Train count           | 160                     |
| Test count            | 40                      |
| Classified            | 40                      |
| Coverage              | 1.000 (100.0%)          |
| Accuracy              | 1.000 (100.0%)          |
| Precision (macro)     | 1.000                   |
| Recall (macro)        | 1.000                   |
| F1 (macro)            | 1.000                   |
| Classification errors | 0                       |
| Infrastructure errors | 0                       |
| Not attempted         | 0                       |
| Invalid replies       | 0                       |

## Per-class metrics

Precision, recall, and F1 use successfully classified held-out rows. An invalid reply counts against recall for its actual level. Infrastructure failures and rows that were not attempted stay outside these metrics. Macro scores are the unweighted mean of the three levels.

| Level        | Support | Precision | Recall |    F1 |
| ------------ | ------: | --------: | -----: | ----: |
| beginner     |      16 |     1.000 |  1.000 | 1.000 |
| intermediate |      12 |     1.000 |  1.000 | 1.000 |
| advanced     |      12 |     1.000 |  1.000 | 1.000 |

## Confusion matrix

Rows are the actual level. Columns are the predicted level. Accuracy uses only successfully classified held-out rows.

| Actual \ Predicted | beginner | intermediate | advanced |
| ------------------ | -------- | ------------ | -------- |
| beginner           | 16       | 0            | 0        |
| intermediate       | 0        | 12           | 0        |
| advanced           | 0        | 0            | 12       |
