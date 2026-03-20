package runtime

import (
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

type RepositorySet struct {
	ProjectContent db.ProjectContentRepository
	Executions     db.ExecutionRepository
	Assets         db.AssetRepository
	ReviewBilling  db.ReviewBillingRepository
	PolicyReader   db.PolicyReader
	GatewayStore   db.GatewayResultStore
	WorkflowRepo   db.WorkflowRepository
	EventPublisher *events.Publisher
}

type ServiceSet struct {
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

func NewRepositorySet(store *db.MemoryStore) RepositorySet {
	if store == nil {
		return RepositorySet{}
	}
	return RepositorySet{
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

func NewServiceSet(repos RepositorySet) ServiceSet {
	policyService := policyapp.NewService(repos.PolicyReader)
	gatewayService := gatewayapp.NewService(repos.GatewayStore, gatewayapp.NewFakeAdapter())
	workflowService := workflowapp.NewService(repos.WorkflowRepo, repos.EventPublisher, temporal.NewInMemoryExecutor(gatewayService), policyService)

	return ServiceSet{
		ExecutionService: executionapp.NewService(repos.Executions, repos.ProjectContent, repos.Assets, repos.ReviewBilling, repos.EventPublisher),
		AssetService:     assetapp.NewService(repos.Assets, repos.Executions),
		ReviewService:    reviewapp.NewService(repos.Executions, repos.ReviewBilling, repos.EventPublisher),
		BillingService:   billingapp.NewService(repos.ReviewBilling, repos.EventPublisher),
		ProjectService:   projectapp.NewService(repos.ProjectContent),
		ContentService:   contentapp.NewService(repos.ProjectContent),
		WorkflowService:  workflowService,
		GatewayService:   gatewayService,
		PolicyService:    policyService,
		UploadService: upload.NewService(upload.Dependencies{
			Assets:         repos.Assets,
			Executions:     repos.Executions,
			Policy:         policyService,
			EventPublisher: repos.EventPublisher,
		}),
		EventPublisher: repos.EventPublisher,
	}
}
