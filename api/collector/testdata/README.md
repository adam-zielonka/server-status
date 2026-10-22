All process cases are synthetic. The expected results were generated from
`collector/collect.py` on 2026-10-22 to preserve its grouping, CPU accounting,
scope isolation and PID-reuse behavior during the Go migration. No host
snapshot, process arguments, environment variables or credentials are included.
Go tests read these fixtures directly; Python is not a test or runtime dependency.
