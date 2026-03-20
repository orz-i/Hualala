package connect

import (
	"net/http"

	"slices"

	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	contentv1connect "github.com/hualala/apps/backend/gen/hualala/content/v1/contentv1connect"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	workflowv1connect "github.com/hualala/apps/backend/gen/hualala/workflow/v1/workflowv1connect"
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

var allowedHealthMethods = []string{http.MethodGet}

type RouteDependencies struct {
	ExecutionService *executionapp.Service
	AssetService     *assetapp.Service
	ReviewService    *reviewapp.Service
	BillingService   *billingapp.Service
	ProjectService   *projectapp.Service
	ContentService   *contentapp.Service
	WorkflowService  *workflowapp.Service
	UploadService    *upload.Service
	EventPublisher   *events.Publisher
}

func NewRouteDependencies(services runtime.ServiceSet) RouteDependencies {
	return RouteDependencies{
		ExecutionService: services.ExecutionService,
		AssetService:     services.AssetService,
		ReviewService:    services.ReviewService,
		BillingService:   services.BillingService,
		ProjectService:   services.ProjectService,
		ContentService:   services.ContentService,
		WorkflowService:  services.WorkflowService,
		UploadService:    services.UploadService,
		EventPublisher:   services.EventPublisher,
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
	if deps.ProjectService != nil {
		path, handler := projectv1connect.NewProjectServiceHandler(&projectHandler{service: deps.ProjectService})
		mux.Handle(path, handler)
	}
	if deps.ContentService != nil {
		path, handler := contentv1connect.NewContentServiceHandler(&contentHandler{service: deps.ContentService})
		mux.Handle(path, handler)
	}
	if deps.WorkflowService != nil {
		path, handler := workflowv1connect.NewWorkflowServiceHandler(&workflowHandler{service: deps.WorkflowService})
		mux.Handle(path, handler)
	}
	sse.RegisterRoutes(mux, deps.EventPublisher)
	if deps.UploadService != nil {
		upload.RegisterRoutes(mux, deps.UploadService)
	}
}
