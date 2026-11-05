package collector

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestSystemdJobRetainsCompletedAttemptAcrossRestart(t *testing.T) {
	ctx := context.Background()
	job := Job{Unit: Unit{Name: "Backup", Unit: "backup.service"}, Kind: "systemd", Timer: "backup.timer"}
	cleared := "LoadState=loaded\nActiveState=inactive\nResult=success\nExecMainStatus=0\n"
	for _, outcome := range []string{"success", "exit-code"} {
		t.Run(outcome, func(t *testing.T) {
			props := "LoadState=loaded\nActiveState=inactive\nResult=" + outcome + "\nExecMainStatus=1\nExecMainStartTimestamp=Mon 2026-01-05 01:00:00 UTC\nExecMainExitTimestamp=Mon 2026-01-05 01:01:00 UTC\n"
			before := (sampler{query: queryResult(props)}).systemdJob(ctx, job, row{"last_success_at": "2026-01-04T00:00:00Z"})
			s := sampler{query: func(_ context.Context, args []string, _ time.Duration, _ map[string]string) ([]byte, error) {
				if strings.Contains(strings.Join(args, " "), "backup.timer") {
					return []byte("LoadState=loaded\nActiveState=active\nNextElapseUSecRealtime=Tue 2026-01-06 01:00:00 UTC\n"), nil
				}
				return []byte(cleared), nil
			}}
			current := before
			for range 3 {
				// Each invocation reads the persisted snapshot, not in-memory state.
				body, err := json.Marshal(current)
				if err != nil {
					t.Fatal(err)
				}
				var persisted row
				if err := json.Unmarshal(body, &persisted); err != nil {
					t.Fatal(err)
				}
				current = s.systemdJob(ctx, job, persisted)
				for _, key := range []string{"status", "last_run_at", "completed_at", "last_success_at", "last_error"} {
					if !reflect.DeepEqual(current[key], before[key]) {
						t.Fatalf("lost %s: before=%v after=%v", key, before[key], current[key])
					}
				}
				if current["next_run_at"] != "2026-01-06T01:00:00Z" || current["timer_state"] != "active" {
					t.Fatalf("schedule not refreshed: %v", current)
				}
			}
			unavailable := (sampler{query: queryFailure}).systemdJob(ctx, job, current)
			if unavailable["error"] == nil || unavailable["last_run_at"] != before["last_run_at"] {
				t.Fatal("query failure lost history or hid source error")
			}
			recovered := s.systemdJob(ctx, job, unavailable)
			if recovered["status"] != before["status"] || recovered["error"] != nil {
				t.Fatalf("query recovery lost completed outcome: %v", recovered)
			}
			running := (sampler{query: queryResult("LoadState=loaded\nActiveState=activating\nResult=success\nExecMainStartTimestamp=Tue 2026-01-06 01:00:00 UTC\n")}).systemdJob(ctx, job, current)
			if running["status"] != "running" || running["completed_at"] != nil || running["last_error"] != nil || running["last_success_at"] != before["last_success_at"] {
				t.Fatalf("new attempt not applied: %v", running)
			}
			interrupted := s.systemdJob(ctx, job, running)
			if interrupted["status"] != "unknown" || interrupted["last_run_at"] != running["last_run_at"] || interrupted["last_success_at"] != before["last_success_at"] {
				t.Fatalf("interrupted attempt not preserved as unknown: %v", interrupted)
			}
		})
	}
}

func TestSystemdJobDoesNotInventSuccessAfterRestart(t *testing.T) {
	job := Job{Unit: Unit{Name: "Backup", Unit: "backup.service"}, Kind: "systemd"}
	for _, old := range []row{
		{},
		{"last_success_at": "2026-01-04T00:00:00Z"},
		{"status": "success", "completed_at": "2026-01-04T00:00:00Z", "last_run_at": "2026-01-05T00:00:00Z"},
	} {
		got := (sampler{query: queryResult("LoadState=loaded\nActiveState=inactive\nResult=success\n")}).systemdJob(context.Background(), job, old)
		if got["status"] != "unknown" {
			t.Fatalf("invented result: %v", got)
		}
	}
	old := row{"status": "success", "completed_at": "2026-01-04T00:00:00Z", "last_success_at": "2026-01-04T00:00:00Z"}
	got := (sampler{query: queryResult("LoadState=loaded\nActiveState=failed\nResult=resources\n")}).systemdJob(context.Background(), job, old)
	if got["status"] != "failure" || got["last_error"] != "resources (exit status 0)" || got["last_success_at"] != old["last_success_at"] {
		t.Fatalf("current pre-execution failure lost: %v", got)
	}
	reset := (sampler{query: queryResult("LoadState=loaded\nActiveState=inactive\nResult=success\n")}).systemdJob(context.Background(), job, got)
	if reset["status"] != "failure" || reset["last_error"] != got["last_error"] || reset["last_success_at"] != old["last_success_at"] {
		t.Fatalf("pre-execution failure lost after reset: %v", reset)
	}
}

func TestSystemdResetFailedDoesNotCreateSuccess(t *testing.T) {
	job := Job{Unit: Unit{Name: "Backup", Unit: "backup.service"}, Kind: "systemd"}
	props := "LoadState=loaded\nActiveState=inactive\nResult=exit-code\nExecMainStatus=1\nExecMainStartTimestamp=Mon 2026-01-05 01:00:00 UTC\nExecMainExitTimestamp=Mon 2026-01-05 01:01:00 UTC\n"
	failed := (sampler{query: queryResult(props)}).systemdJob(context.Background(), job, row{"last_success_at": "2026-01-04T00:00:00Z"})
	props = strings.ReplaceAll(strings.ReplaceAll(props, "Result=exit-code", "Result=success"), "ExecMainStatus=1", "ExecMainStatus=0")
	reset := (sampler{query: queryResult(props)}).systemdJob(context.Background(), job, failed)
	rebooted := (sampler{query: queryResult("LoadState=loaded\nActiveState=inactive\nResult=success\n")}).systemdJob(context.Background(), job, reset)
	for _, got := range []row{reset, rebooted} {
		for _, key := range []string{"status", "last_error", "last_run_at", "completed_at", "last_success_at"} {
			if got[key] != failed[key] {
				t.Fatalf("reset-failed changed %s: %v", key, got)
			}
		}
	}
	props = strings.ReplaceAll(props, "2026-01-05", "2026-01-06")
	succeeded := (sampler{query: queryResult(props)}).systemdJob(context.Background(), job, rebooted)
	if succeeded["status"] != "success" || succeeded["last_error"] != nil || succeeded["last_success_at"] != "2026-01-06T01:01:00Z" {
		t.Fatalf("new success not applied: %v", succeeded)
	}
}
