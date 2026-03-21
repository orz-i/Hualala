package runtime

import (
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/authapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/orgapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

type RepositorySet struct {
	AuthOrg        db.AuthOrgRepository
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
	AuthService      *authapp.Service
	OrgService       *orgapp.Service
	Authorizer       authz.Authorizer
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

type Factory struct {
	store db.RuntimeStore
}

func NewFactory(store db.RuntimeStore) Factory {
	return Factory{store: store}
}

func (f Factory) Repositories() RepositorySet {
	if f.store == nil {
		return RepositorySet{}
	}
	return RepositorySet{
		AuthOrg:        f.store,
		ProjectContent: f.store,
		Executions:     f.store,
		Assets:         f.store,
		ReviewBilling:  f.store,
		PolicyReader:   f.store,
		GatewayStore:   f.store,
		WorkflowRepo:   f.store,
		EventPublisher: f.store.Publisher(),
	}
}

func (f Factory) Services() ServiceSet {
	repos := f.Repositories()
	authorizer := authz.NewAuthorizer(repos.AuthOrg)
	policyService := policyapp.NewService(repos.PolicyReader)
	gatewayService := gatewayapp.NewService(repos.GatewayStore, gatewayapp.NewFakeAdapter())
	workflowService := workflowapp.NewService(repos.WorkflowRepo, repos.EventPublisher, temporal.NewInMemoryExecutor(gatewayService), policyService)

	return ServiceSet{
		AuthService:      authapp.NewService(repos.AuthOrg, authorizer),
		OrgService:       orgapp.NewService(repos.AuthOrg, authorizer),
		Authorizer:       authorizer,
		ExecutionService: executionapp.NewService(repos.Executions, repos.ProjectContent, repos.Assets, repos.ReviewBilling, repos.EventPublisher),
		AssetService:     assetapp.NewService(repos.Assets, repos.Executions, repos.EventPublisher),
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
			Authorizer:     authorizer,
			EventPublisher: repos.EventPublisher,
		}),
		EventPublisher: repos.EventPublisher,
	}
}
