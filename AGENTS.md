# Test reporting

- After changing Rogue0 gameplay, run the relevant suites (or `npm run test:rogue0`). Each suite automatically appends its result to `logs/rogue0-tests.jsonl`, including failures. Do not delete or rewrite this history to hide failures.
- In your completion report, mention test failures encountered during the work, what caused them, and whether they were fixed—not just the final passing result. Distinguish actual game bugs from incorrect tests or environment problems.
- Use `npm run test:rogue0:history` when the user asks about test usefulness or past failures. Counts are suite executions, not unique bugs.
- For deliberate failures used to verify tests or logging, set `ROGUE0_TEST_PURPOSE=verification` (or `mutation`) so they do not inflate normal development failure counts. Do not use these labels for ordinary development failures.
- History is local and git-ignored. It begins when logging was added; it is not a record of earlier runs. The in-process logger cannot record syntax/import failures before initialization, forced termination, or tests that bypass these scripts.
