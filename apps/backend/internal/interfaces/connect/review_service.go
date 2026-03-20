package connect

import (
	"net/http"

	"github.com/hualala/apps/backend/internal/application/reviewapp"
)

func registerReviewRoutes(mux *http.ServeMux, deps RouteDependencies) {
	if deps.ReviewService == nil {
		return
	}

	mux.HandleFunc("/connect/hualala.review.v1.ReviewService/CreateEvaluationRun", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[reviewapp.CreateEvaluationRunInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ReviewService.CreateEvaluationRun(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapEvaluationRun(record))
	})

	mux.HandleFunc("/connect/hualala.review.v1.ReviewService/ListEvaluationRuns", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		records, err := deps.ReviewService.ListEvaluationRuns(r.Context(), reviewapp.ListEvaluationRunsInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}

		runs := make([]map[string]any, 0, len(records))
		for _, record := range records {
			runs = append(runs, mapEvaluationRun(record))
		}
		writeJSON(w, http.StatusOK, map[string]any{"evaluation_runs": runs})
	})

	mux.HandleFunc("/connect/hualala.review.v1.ReviewService/CreateShotReview", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[reviewapp.CreateShotReviewInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.ReviewService.CreateShotReview(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapShotReview(record))
	})

	mux.HandleFunc("/connect/hualala.review.v1.ReviewService/ListShotReviews", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		records, err := deps.ReviewService.ListShotReviews(r.Context(), reviewapp.ListShotReviewsInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}

		reviews := make([]map[string]any, 0, len(records))
		for _, record := range records {
			reviews = append(reviews, mapShotReview(record))
		}
		writeJSON(w, http.StatusOK, map[string]any{"shot_reviews": reviews})
	})

	mux.HandleFunc("/connect/hualala.review.v1.ReviewService/GetShotReviewSummary", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		summary, err := deps.ReviewService.GetShotReviewSummary(r.Context(), reviewapp.GetShotReviewSummaryInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"shot_execution_id": summary.ShotExecutionID,
			"latest_conclusion": summary.LatestConclusion,
			"latest_review_id":  summary.LatestReviewID,
		})
	})
}
