package runtime

import (
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/authapp"
	"github.com/hualala/apps/backend/internal/application/backupapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/modelgovernanceapp"
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
	AuthOrg         db.AuthOrgRepository
	ProjectContent  db.ProjectContentRepository
	Executions      db.ExecutionRepository
	Assets          db.AssetRepository
	ReviewBilling   db.ReviewBillingRepository
	ModelGovernance db.ModelGovernanceRepository
	PolicyReader    db.PolicyReader
	GatewayStore    db.GatewayResultStore
	WorkflowRepo    db.WorkflowRepository
	BackupRepo      db.BackupRepository
	EventPublisher  *events.Publisher
}

type ServiceSet struct {
	AuthService            *authapp.Service
	OrgService             *orgapp.Service
	Authorizer             authz.Authorizer
	BackupService          *backupapp.Service
	ExecutionService       *executionapp.Service
	AssetService           *assetapp.Service
	ReviewService          *reviewapp.Service
	BillingService         *billingapp.Service
	ModelGovernanceService *modelgovernanceapp.Service
	ProjectService         *projectapp.Service
	ContentService         *contentapp.Service
	WorkflowService        *workflowapp.Service
	GatewayService         *gatewayapp.Service
	PolicyService          *policyapp.Service
	UploadService          *upload.Service
	EventPublisher         *events.Publisher
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
		AuthOrg:         f.store,
		ProjectContent:  f.store,
		Executions:      f.store,
		Assets:          f.store,
		ReviewBilling:   f.store,
		ModelGovernance: f.store,
		PolicyReader:    f.store,
		GatewayStore:    f.store,
		WorkflowRepo:    f.store,
		BackupRepo:      f.store,
		EventPublisher:  f.store.Publisher(),
	}
}

func (f Factory) Services() ServiceSet {
	return f.services(nil)
}

func (f Factory) WorkerServices() ServiceSet {
	repos := f.Repositories()
	gatewayService := gatewayapp.NewService(repos.GatewayStore, gatewayapp.NewRuntimeAdapter())
	return f.services(temporal.NewDirectExecutor(gatewayService))
}

func (f Factory) services(workflowExecutor temporal.Executor) ServiceSet {
	repos := f.Repositories()
	authorizer := authz.NewAuthorizer(repos.AuthOrg)
	policyService := policyapp.NewService(repos.PolicyReader)
	gatewayService := gatewayapp.NewService(repos.GatewayStore, gatewayapp.NewRuntimeAdapter())
	workflowService := workflowapp.NewService(repos.WorkflowRepo, repos.EventPublisher, workflowExecutor, policyService)

	return ServiceSet{
		AuthService:            authapp.NewService(repos.AuthOrg, authorizer),
		OrgService:             orgapp.NewService(repos.AuthOrg, authorizer),
		Authorizer:             authorizer,
		BackupService:          backupapp.NewService(repos.BackupRepo, authorizer),
		ExecutionService:       executionapp.NewService(repos.Executions, repos.ProjectContent, repos.Assets, repos.ReviewBilling, repos.EventPublisher),
		AssetService:           assetapp.NewService(repos.Assets, repos.Executions, repos.EventPublisher),
		ReviewService:          reviewapp.NewService(repos.Executions, repos.ReviewBilling, repos.EventPublisher),
		BillingService:         billingapp.NewService(repos.ReviewBilling, repos.EventPublisher),
		ModelGovernanceService: modelgovernanceapp.NewService(repos.ModelGovernance, authorizer),
		ProjectService:         projectapp.NewService(f.store),
		ContentService:         contentapp.NewService(repos.ProjectContent, repos.EventPublisher),
		WorkflowService:        workflowService,
		GatewayService:         gatewayService,
		PolicyService:          policyService,
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
