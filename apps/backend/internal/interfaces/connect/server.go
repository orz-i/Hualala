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
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/temporal"
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
	GatewayService   *gatewayapp.Service
	PolicyService    *policyapp.Service
	UploadService    *upload.Service
	EventPublisher   *events.Publisher
}

type RuntimeDependencies struct {
	ProjectContent db.ProjectContentRepository
	Executions     db.ExecutionRepository
	Assets         db.AssetRepository
	ReviewBilling  db.ReviewBillingRepository
	PolicyReader   db.PolicyReader
	GatewayStore   db.GatewayResultStore
	WorkflowRepo   db.WorkflowRepository
	EventPublisher *events.Publisher
}

func NewRuntimeDependenciesFromStore(store *db.MemoryStore) RuntimeDependencies {
	return RuntimeDependencies{
		ProjectContent: store,
		Executions:     store,
		Assets:         store,
		ReviewBilling:  store,
		PolicyReader:   store,
		GatewayStore:   store,
		WorkflowRepo:   store,
		EventPublisher: store.EventPublisher,
	}
}

func NewRouteDependencies(runtime RuntimeDependencies) RouteDependencies {
	policyService := policyapp.NewService(runtime.PolicyReader)
	gatewayService := gatewayapp.NewService(runtime.GatewayStore, gatewayapp.NewFakeAdapter())
	workflowService := workflowapp.NewService(runtime.WorkflowRepo, runtime.EventPublisher, temporal.NewInMemoryExecutor(gatewayService), policyService)
	return RouteDependencies{
		ExecutionService: executionapp.NewService(runtime.Executions, runtime.ProjectContent, runtime.Assets, runtime.ReviewBilling, runtime.EventPublisher),
		AssetService:     assetapp.NewService(runtime.Assets, runtime.Executions),
		ReviewService:    reviewapp.NewService(runtime.Executions, runtime.ReviewBilling, runtime.EventPublisher),
		BillingService:   billingapp.NewService(runtime.ReviewBilling, runtime.EventPublisher),
		ProjectService:   projectapp.NewService(runtime.ProjectContent),
		ContentService:   contentapp.NewService(runtime.ProjectContent),
		WorkflowService:  workflowService,
		GatewayService:   gatewayService,
		PolicyService:    policyService,
		UploadService: upload.NewService(upload.Dependencies{
			Assets:         runtime.Assets,
			Executions:     runtime.Executions,
			Policy:         policyService,
			EventPublisher: runtime.EventPublisher,
		}),
		EventPublisher: runtime.EventPublisher,
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
	upload.RegisterRoutes(mux, deps.UploadService)
}
