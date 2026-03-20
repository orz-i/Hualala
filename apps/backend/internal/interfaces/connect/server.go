package connect

import (
	"net/http"

	"slices"

	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

var allowedHealthMethods = []string{http.MethodGet}

type RouteDependencies struct {
	ExecutionService *executionapp.Service
	AssetService     *assetapp.Service
	ReviewService    *reviewapp.Service
	BillingService   *billingapp.Service
	EventPublisher   *events.Publisher
	Store            *db.MemoryStore
}

func NewRouteDependencies(store *db.MemoryStore) RouteDependencies {
	return RouteDependencies{
		ExecutionService: executionapp.NewService(store),
		AssetService:     assetapp.NewService(store),
		ReviewService:    reviewapp.NewService(store),
		BillingService:   billingapp.NewService(store),
		EventPublisher:   store.EventPublisher,
		Store:            store,
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

	if deps.ExecutionService != nil {
		path, handler := executionv1connect.NewExecutionServiceHandler(&executionHandler{service: deps.ExecutionService})
		mux.Handle(path, handler)
	}
	if deps.AssetService != nil {
		path, handler := assetv1connect.NewAssetServiceHandler(&assetHandler{service: deps.AssetService})
		mux.Handle(path, handler)
	}
	if deps.ReviewService != nil {
		path, handler := reviewv1connect.NewReviewServiceHandler(&reviewHandler{service: deps.ReviewService})
		mux.Handle(path, handler)
	}
	if deps.BillingService != nil {
		path, handler := billingv1connect.NewBillingServiceHandler(&billingHandler{service: deps.BillingService})
		mux.Handle(path, handler)
	}
	sse.RegisterRoutes(mux, deps.EventPublisher)
	upload.RegisterRoutes(mux, deps.Store)
}
