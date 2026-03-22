package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type postgresEventRecorder struct {
	db *sql.DB
}

type postgresEventFilter struct {
	organizationID string
	projectID      string
}

type postgresEventPayload struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	PayloadText  string `json:"payload_text"`
}

func newPostgresEventRecorder(handle *sql.DB) *postgresEventRecorder {
	if handle == nil {
		return nil
	}
	return &postgresEventRecorder{db: handle}
}

func (r *postgresEventRecorder) Append(ctx context.Context, event events.Event) (events.Event, error) {
	if r == nil || r.db == nil {
		return event, fmt.Errorf("db: postgres event recorder requires database handle")
	}

	eventID := strings.TrimSpace(event.ID)
	if _, err := uuid.Parse(eventID); err != nil {
		eventID = uuid.NewString()
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}

	aggregateID := normalizeEventAggregateID(event)
	payloadText, err := jsonString(postgresEventPayload{
		ResourceType: strings.TrimSpace(event.ResourceType),
		ResourceID:   strings.TrimSpace(event.ResourceID),
		PayloadText:  event.Payload,
	})
	if err != nil {
		return event, fmt.Errorf("db: encode durable event %s: %w", eventID, err)
	}
	if _, err := r.db.ExecContext(ctx, `
		INSERT INTO event_outbox (
			id, organization_id, project_id, aggregate_type, aggregate_id, event_type,
			payload, published_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    aggregate_type = EXCLUDED.aggregate_type,
		    aggregate_id = EXCLUDED.aggregate_id,
		    event_type = EXCLUDED.event_type,
		    payload = EXCLUDED.payload,
		    published_at = EXCLUDED.published_at
	`, eventID, event.OrganizationID, nullableUUID(event.ProjectID), defaultString(event.ResourceType, "event"), aggregateID, event.EventType, payloadText, event.CreatedAt, event.CreatedAt); err != nil {
		return event, fmt.Errorf("db: append durable event %s: %w", eventID, err)
	}
	event.ID = eventID
	return event, nil
}

func (r *postgresEventRecorder) List(ctx context.Context, organizationID string, projectID string, lastEventID string) ([]events.Event, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("db: postgres event recorder requires database handle")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	filter := postgresEventFilter{
		organizationID: strings.TrimSpace(organizationID),
		projectID:      strings.TrimSpace(projectID),
	}
	query := `
		SELECT id::text, event_type, organization_id::text, COALESCE(project_id::text, ''),
		       aggregate_type, aggregate_id::text, payload::text, created_at
		FROM event_outbox
		WHERE 1 = 1
	`
	args := make([]any, 0, 4)
	query, args = appendPostgresEventFilter(query, args, filter)

	cursorID := strings.TrimSpace(lastEventID)
	if cursorID != "" {
		cursorCreatedAt, cursorUUID, found, err := r.lookupReplayCursor(ctx, filter, cursorID)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, nil
		}
		args = append(args, cursorCreatedAt, cursorUUID)
		query += fmt.Sprintf(" AND (created_at, id) > ($%d, $%d)", len(args)-1, len(args))
	}
	query += " ORDER BY created_at ASC, id ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("db: list durable events: %w", err)
	}
	defer rows.Close()

	all := make([]events.Event, 0)
	for rows.Next() {
		var (
			id, eventType, rowOrgID, rowProjectID, aggregateType, aggregateID, payloadText string
			createdAt                                                                      time.Time
		)
		if err := rows.Scan(&id, &eventType, &rowOrgID, &rowProjectID, &aggregateType, &aggregateID, &payloadText, &createdAt); err != nil {
			return nil, fmt.Errorf("db: scan durable event: %w", err)
		}
		payload := postgresEventPayload{}
		if payloadText != "" {
			if err := json.Unmarshal([]byte(payloadText), &payload); err != nil {
				return nil, fmt.Errorf("db: decode durable event %s: %w", id, err)
			}
		}
		resourceType := payload.ResourceType
		if strings.TrimSpace(resourceType) == "" {
			resourceType = aggregateType
		}
		resourceID := payload.ResourceID
		if strings.TrimSpace(resourceID) == "" {
			resourceID = aggregateID
		}
		all = append(all, events.Event{
			ID:             id,
			EventType:      eventType,
			OrganizationID: rowOrgID,
			ProjectID:      rowProjectID,
			ResourceType:   resourceType,
			ResourceID:     resourceID,
			Payload:        payload.PayloadText,
			CreatedAt:      createdAt.UTC(),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("db: iterate durable events: %w", err)
	}
	return all, nil
}

func (r *postgresEventRecorder) Reset(ctx context.Context) error {
	if r == nil || r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `DELETE FROM event_outbox`)
	if err != nil {
		return fmt.Errorf("db: reset durable events: %w", err)
	}
	return nil
}

func normalizeEventAggregateID(event events.Event) string {
	if parsed, err := uuid.Parse(strings.TrimSpace(event.ResourceID)); err == nil {
		return parsed.String()
	}
	if parsed, err := uuid.Parse(strings.TrimSpace(event.ID)); err == nil {
		return parsed.String()
	}
	return uuid.NewString()
}

func appendPostgresEventFilter(query string, args []any, filter postgresEventFilter) (string, []any) {
	if filter.organizationID != "" {
		args = append(args, filter.organizationID)
		query += fmt.Sprintf(" AND organization_id = $%d", len(args))
	}
	if filter.projectID != "" {
		args = append(args, filter.projectID)
		query += fmt.Sprintf(" AND project_id = $%d", len(args))
	}
	return query, args
}

func (r *postgresEventRecorder) lookupReplayCursor(ctx context.Context, filter postgresEventFilter, lastEventID string) (time.Time, uuid.UUID, bool, error) {
	cursorUUID, err := uuid.Parse(lastEventID)
	if err != nil {
		return time.Time{}, uuid.UUID{}, false, nil
	}

	query := `
		SELECT created_at
		FROM event_outbox
		WHERE id = $1
	`
	args := []any{cursorUUID}
	query, args = appendPostgresEventFilter(query, args, filter)

	var createdAt time.Time
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&createdAt); err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, uuid.UUID{}, false, nil
		}
		return time.Time{}, uuid.UUID{}, false, fmt.Errorf("db: lookup durable event cursor %s: %w", lastEventID, err)
	}
	return createdAt.UTC(), cursorUUID, true, nil
}
