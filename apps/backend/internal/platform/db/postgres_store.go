package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/platform/events"
)

const defaultGatewaySnapshotStoreKey = "gateway_results"

type PostgresStore struct {
	db                 *sql.DB
	publisher          *events.Publisher
	gatewaySnapshotKey string
}

func NewPostgresStore(handle *sql.DB, storeKey string) *PostgresStore {
	return &PostgresStore{
		db:                 handle,
		publisher:          events.NewDurablePublisher(newPostgresEventRecorder(handle)),
		gatewaySnapshotKey: gatewayResultsStoreKey(storeKey),
	}
}

func ResetPostgresRuntimeState(ctx context.Context, handle *sql.DB) error {
	return resetRelationalState(ctx, handle)
}

func gatewayResultsStoreKey(storeKey string) string {
	trimmed := strings.TrimSpace(storeKey)
	switch trimmed {
	case "", defaultSnapshotStoreKey:
		return defaultGatewaySnapshotStoreKey
	default:
		return fmt.Sprintf("%s:%s", defaultGatewaySnapshotStoreKey, trimmed)
	}
}

func (s *PostgresStore) Publisher() *events.Publisher {
	if s == nil {
		return nil
	}
	return s.publisher
}

func (*PostgresStore) GenerateProjectID() string           { return uuid.NewString() }
func (*PostgresStore) GenerateEpisodeID() string           { return uuid.NewString() }
func (*PostgresStore) GenerateSceneID() string             { return uuid.NewString() }
func (*PostgresStore) GenerateShotID() string              { return uuid.NewString() }
func (*PostgresStore) GenerateSnapshotID() string          { return uuid.NewString() }
func (*PostgresStore) GenerateTranslationGroupID() string  { return uuid.NewString() }
func (*PostgresStore) GenerateShotExecutionID() string     { return uuid.NewString() }
func (*PostgresStore) GenerateShotExecutionRunID() string  { return uuid.NewString() }
func (*PostgresStore) GenerateImportBatchID() string       { return uuid.NewString() }
func (*PostgresStore) GenerateImportBatchItemID() string   { return uuid.NewString() }
func (*PostgresStore) GenerateUploadSessionID() string     { return uuid.NewString() }
func (*PostgresStore) GenerateUploadFileID() string        { return uuid.NewString() }
func (*PostgresStore) GenerateMediaAssetID() string        { return uuid.NewString() }
func (*PostgresStore) GenerateMediaAssetVariantID() string { return uuid.NewString() }
func (*PostgresStore) GenerateCandidateAssetID() string    { return uuid.NewString() }
func (*PostgresStore) GenerateReviewID() string            { return uuid.NewString() }
func (*PostgresStore) GenerateEvaluationRunID() string     { return uuid.NewString() }
func (*PostgresStore) GenerateBudgetID() string            { return uuid.NewString() }
func (*PostgresStore) GenerateUsageRecordID() string       { return uuid.NewString() }
func (*PostgresStore) GenerateBillingEventID() string      { return uuid.NewString() }
func (*PostgresStore) GenerateWorkflowRunID() string       { return uuid.NewString() }
func (*PostgresStore) GenerateWorkflowStepID() string      { return uuid.NewString() }
func (*PostgresStore) GenerateJobID() string               { return uuid.NewString() }
func (*PostgresStore) GenerateStateTransitionID() string   { return uuid.NewString() }
func (*PostgresStore) GenerateGatewayExternalRequestID() string {
	return uuid.NewString()
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func nullTimeValue(value sql.NullTime) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time.UTC()
}

func (s *PostgresStore) GetGatewayResult(idempotencyKey string) (gateway.GatewayResult, bool) {
	if s == nil || s.db == nil {
		return gateway.GatewayResult{}, false
	}
	key := strings.TrimSpace(idempotencyKey)
	if key == "" {
		return gateway.GatewayResult{}, false
	}

	var payload sql.NullString
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT (payload -> ($2::text))::text FROM app_state_snapshots WHERE store_key = $1`,
		s.gatewaySnapshotKey,
		key,
	).Scan(&payload)
	if err != nil {
		return gateway.GatewayResult{}, false
	}
	if !payload.Valid || strings.TrimSpace(payload.String) == "" {
		return gateway.GatewayResult{}, false
	}

	record := gateway.GatewayResult{}
	if err := json.Unmarshal([]byte(payload.String), &record); err != nil {
		return gateway.GatewayResult{}, false
	}
	return record, true
}

func (s *PostgresStore) SaveGatewayResult(ctx context.Context, idempotencyKey string, result gateway.GatewayResult) error {
	if s == nil || s.db == nil {
		return fmt.Errorf("db: postgres store requires database handle")
	}
	key := strings.TrimSpace(idempotencyKey)
	if key == "" {
		return fmt.Errorf("db: gateway idempotency key is required")
	}
	payload, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("db: encode gateway snapshot result %s: %w", key, err)
	}
	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO app_state_snapshots (store_key, payload, updated_at)
		 VALUES ($1, jsonb_build_object($2::text, $3::jsonb), NOW())
		 ON CONFLICT (store_key)
		 DO UPDATE SET payload = jsonb_set(
		 	COALESCE(app_state_snapshots.payload, '{}'::jsonb),
		 	ARRAY[$2::text]::text[],
		 	$3::jsonb,
		 	true
		 ),
		 updated_at = NOW()`,
		s.gatewaySnapshotKey,
		key,
		string(payload),
	); err != nil {
		return fmt.Errorf("db: save gateway snapshot %s: %w", key, err)
	}
	return nil
}
