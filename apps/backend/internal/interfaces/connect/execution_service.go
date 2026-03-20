package connect

import (
	"net/http"

	"github.com/hualala/apps/backend/internal/application/executionapp"
)

func registerExecutionRoutes(mux *http.ServeMux, deps RouteDependencies) {
	if deps.ExecutionService == nil {
		return
	}

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/GetShotWorkbench", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}
		workbench, err := deps.ExecutionService.GetShotWorkbench(r.Context(), executionapp.GetShotWorkbenchInput{
			ShotID: r.URL.Query().Get("shot_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapExecutionWorkbench(workbench))
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/GetShotExecution", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}
		record, err := deps.ExecutionService.GetShotExecution(r.Context(), executionapp.GetShotExecutionInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotExecution(record))
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/ListShotExecutionRuns", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}
		records, err := deps.ExecutionService.ListShotExecutionRuns(r.Context(), executionapp.ListShotExecutionRunsInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}

		runs := make([]map[string]any, 0, len(records))
		for _, record := range records {
			runs = append(runs, mapShotExecutionRun(record))
		}
		writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/StartShotExecutionRun", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		var input executionapp.StartShotExecutionRunInput
		input, err := decodeJSONBody[executionapp.StartShotExecutionRunInput](r)
		if err != nil {
			writeError(w, err)
			return
		}

		run, err := deps.ExecutionService.StartShotExecutionRun(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotExecutionRun(run))
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[executionapp.SelectPrimaryAssetInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ExecutionService.SelectPrimaryAsset(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotExecution(record))
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[executionapp.RunSubmissionGateChecksInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ExecutionService.RunSubmissionGateChecks(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"passed_checks": record.PassedChecks,
			"failed_checks": record.FailedChecks,
		})
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/SubmitShotForReview", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[executionapp.SubmitShotForReviewInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ExecutionService.SubmitShotForReview(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotExecution(record))
	})

	mux.HandleFunc("/connect/hualala.execution.v1.ExecutionService/MarkShotReworkRequired", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[executionapp.MarkShotReworkRequiredInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ExecutionService.MarkShotReworkRequired(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotExecution(record))
	})
}
