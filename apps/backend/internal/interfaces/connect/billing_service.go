package connect

import (
	"net/http"

	"github.com/hualala/apps/backend/internal/application/billingapp"
)

func registerBillingRoutes(mux *http.ServeMux, deps RouteDependencies) {
	if deps.BillingService == nil {
		return
	}

	mux.HandleFunc("/connect/hualala.billing.v1.BillingService/UpdateBudgetPolicy", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[billingapp.SetProjectBudgetInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.BillingService.SetProjectBudget(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id":             record.ID,
			"org_id":         record.OrgID,
			"project_id":     record.ProjectID,
			"limit_cents":    record.LimitCents,
			"reserved_cents": record.ReservedCents,
		})
	})

	mux.HandleFunc("/connect/hualala.billing.v1.BillingService/GetBudgetSnapshot", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		record, err := deps.BillingService.GetBudgetSnapshot(r.Context(), billingapp.GetBudgetSnapshotInput{
			ProjectID: r.URL.Query().Get("project_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"project_id":             record.ProjectID,
			"limit_cents":            record.LimitCents,
			"reserved_cents":         record.ReservedCents,
			"remaining_budget_cents": record.RemainingBudgetCents,
		})
	})

	mux.HandleFunc("/connect/hualala.billing.v1.BillingService/ListUsageRecords", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		records, err := deps.BillingService.ListUsageRecords(r.Context(), billingapp.ListUsageRecordsInput{
			ProjectID: r.URL.Query().Get("project_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		items := make([]map[string]any, 0, len(records))
		for _, record := range records {
			items = append(items, map[string]any{
				"id":                    record.ID,
				"project_id":            record.ProjectID,
				"shot_execution_id":     record.ShotExecutionID,
				"shot_execution_run_id": record.ShotExecutionRunID,
				"meter":                 record.Meter,
				"amount_cents":          record.AmountCents,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"usage_records": items})
	})

	mux.HandleFunc("/connect/hualala.billing.v1.BillingService/ListBillingEvents", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		records, err := deps.BillingService.ListBillingEvents(r.Context(), billingapp.ListBillingEventsInput{
			ProjectID: r.URL.Query().Get("project_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		items := make([]map[string]any, 0, len(records))
		for _, record := range records {
			items = append(items, map[string]any{
				"id":                    record.ID,
				"event_type":            record.EventType,
				"project_id":            record.ProjectID,
				"shot_execution_id":     record.ShotExecutionID,
				"shot_execution_run_id": record.ShotExecutionRunID,
				"amount_cents":          record.AmountCents,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"billing_events": items})
	})
}
