package connect

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"slices"

	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/db"
)

var allowedHealthMethods = []string{http.MethodGet}

type RouteDependencies struct {
	ExecutionService *executionapp.Service
	AssetService     *assetapp.Service
	ReviewService    *reviewapp.Service
	BillingService   *billingapp.Service
}

func NewRouteDependencies(store *db.MemoryStore) RouteDependencies {
	return RouteDependencies{
		ExecutionService: executionapp.NewService(store),
		AssetService:     assetapp.NewService(store),
		ReviewService:    reviewapp.NewService(store),
		BillingService:   billingapp.NewService(store),
	}
}

func RegisterRoutes(mux *http.ServeMux, deps RouteDependencies) {
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !slices.Contains(allowedHealthMethods, r.Method) {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	registerExecutionRoutes(mux, deps)
	registerAssetRoutes(mux, deps)
	registerReviewRoutes(mux, deps)
	registerBillingRoutes(mux, deps)
	sse.RegisterRoutes(mux)
	upload.RegisterRoutes(mux)
}

func decodeJSONBody[T any](r *http.Request) (T, error) {
	var payload T
	if r.Body == nil {
		return payload, nil
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return payload, err
	}
	return payload, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method != method {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	if errors.Is(err, context.Canceled) || strings.Contains(strings.ToLower(err.Error()), "required") || strings.Contains(strings.ToLower(err.Error()), "not found") || strings.Contains(strings.ToLower(err.Error()), "budget exceeded") || strings.Contains(strings.ToLower(err.Error()), "failed") {
		status = http.StatusBadRequest
	}
	writeJSON(w, status, map[string]any{
		"error": err.Error(),
	})
}
