package events

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
)

func TestPublisherSubscribeReceivesFutureMatchingEvents(t *testing.T) {
	publisher := NewPublisher()
	stream, unsubscribe := publisher.Subscribe("org-1", "project-1")
	defer unsubscribe()

	publisher.Publish(Event{
		EventType:      "budget.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		Payload:        `{"limit_cents":500}`,
	})

	select {
	case event := <-stream:
		if event.EventType != "budget.updated" {
			t.Fatalf("expected budget.updated event, got %q", event.EventType)
		}
		if event.ProjectID != "project-1" {
			t.Fatalf("expected project-1, got %q", event.ProjectID)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected subscriber to receive a matching future event")
	}
}

func TestPublisherUnsubscribeRemovesLiveSubscriber(t *testing.T) {
	publisher := NewPublisher()
	_, unsubscribe := publisher.Subscribe("org-1", "project-1")
	if got := publisher.SubscriptionCount(); got != 1 {
		t.Fatalf("expected 1 subscription, got %d", got)
	}

	unsubscribe()

	if got := publisher.SubscriptionCount(); got != 0 {
		t.Fatalf("expected 0 subscriptions after unsubscribe, got %d", got)
	}
}

func TestPublisherListWithContextFallsBackWhenDurableListFails(t *testing.T) {
	recorder := &stubRecorder{
		appendFn: func(_ context.Context, event Event) (Event, error) {
			if event.ID == "" {
				event.ID = "evt-durable-1"
			}
			return event, nil
		},
		listErr: errors.New("durable list unavailable"),
	}
	publisher := NewDurablePublisher(recorder)
	publisher.PublishWithContext(context.Background(), Event{
		EventType:      "workflow.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		Payload:        `{"status":"running"}`,
	})

	items := publisher.ListWithContext(context.Background(), "org-1", "project-1", "")
	if len(items) != 1 {
		t.Fatalf("expected 1 fallback event, got %d", len(items))
	}
	if items[0].EventType != "workflow.updated" {
		t.Fatalf("expected workflow.updated event, got %q", items[0].EventType)
	}
}

func TestPublisherListWithContextIncludesFallbackEventsWhenDurableReplaySucceeds(t *testing.T) {
	recorder := &stubRecorder{
		appendErr: errors.New("durable append unavailable"),
		listFn: func(_ context.Context, organizationID string, projectID string, lastEventID string) ([]Event, error) {
			return []Event{
				{
					ID:             "evt-durable-1",
					EventType:      "workflow.updated",
					OrganizationID: organizationID,
					ProjectID:      projectID,
					Payload:        `{"status":"running"}`,
					CreatedAt:      time.Unix(100, 0).UTC(),
				},
			}, nil
		},
	}
	publisher := NewDurablePublisher(recorder)
	publisher.PublishWithContext(context.Background(), Event{
		ID:             "evt-fallback-1",
		EventType:      "asset.import_batch.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		Payload:        `{"status":"confirmed"}`,
		CreatedAt:      time.Unix(101, 0).UTC(),
	})

	items := publisher.ListWithContext(context.Background(), "org-1", "project-1", "")
	if len(items) != 2 {
		t.Fatalf("expected durable replay plus fallback event, got %d items", len(items))
	}
	if got := items[1].ID; got != "evt-fallback-1" {
		t.Fatalf("expected fallback replay id %q, got %q", "evt-fallback-1", got)
	}
}

func TestPublisherResetWithContextReturnsRecorderError(t *testing.T) {
	recorder := &stubRecorder{resetErr: errors.New("reset failed")}
	publisher := NewDurablePublisher(recorder)

	if err := publisher.ResetWithContext(context.Background()); err == nil {
		t.Fatal("expected ResetWithContext to surface recorder reset error")
	}
}

func TestPublishShotExecutionUpdatedTrimsScopeAndPayloadFields(t *testing.T) {
	publisher := NewPublisher()

	PublishShotExecutionUpdated(context.Background(), publisher, execution.ShotExecution{
		ID:           "shot-execution-1",
		OrgID:        " org-1 ",
		ProjectID:    " project-1 ",
		ShotID:       "shot-1",
		Status:       "candidate_ready",
		CurrentRunID: "run-1",
	}, " candidate-1 ", " asset-1 ")

	items := publisher.List("org-1", "project-1", "")
	if len(items) != 1 {
		t.Fatalf("expected trimmed replay query to return 1 event, got %d", len(items))
	}
	event := items[0]
	if got := event.OrganizationID; got != "org-1" {
		t.Fatalf("expected trimmed org id %q, got %q", "org-1", got)
	}
	if got := event.ProjectID; got != "project-1" {
		t.Fatalf("expected trimmed project id %q, got %q", "project-1", got)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if got := payload["candidate_asset_id"].(string); got != "candidate-1" {
		t.Fatalf("expected trimmed candidate_asset_id %q, got %q", "candidate-1", got)
	}
	if got := payload["asset_id"].(string); got != "asset-1" {
		t.Fatalf("expected trimmed asset_id %q, got %q", "asset-1", got)
	}
}

func TestPublishCollaborationUpdatedTrimsScopeAndPayloadFields(t *testing.T) {
	publisher := NewPublisher()
	leaseExpiresAt := time.Unix(200, 0).UTC()

	PublishCollaborationUpdated(context.Background(), publisher, PublishCollaborationUpdatedInput{
		OrganizationID: " org-1 ",
		ProjectID:      " project-1 ",
		ChangedUserID:  " user-1 ",
		ChangeKind:     " lease_claimed ",
		Session: content.CollaborationSession{
			ID:               "session-1",
			OwnerType:        "shot",
			OwnerID:          "shot-1",
			DraftVersion:     3,
			LockHolderUserID: " user-1 ",
			LeaseExpiresAt:   leaseExpiresAt,
			ConflictSummary:  " locked ",
		},
		Presences: []content.CollaborationPresence{
			{ID: "presence-1", UserID: "user-1"},
			{ID: "presence-2", UserID: "user-2"},
		},
	})

	items := publisher.List("org-1", "project-1", "")
	if len(items) != 1 {
		t.Fatalf("expected trimmed replay query to return 1 event, got %d", len(items))
	}
	event := items[0]
	if got := event.EventType; got != "content.collaboration.updated" {
		t.Fatalf("expected collaboration event type, got %q", got)
	}
	if got := event.ResourceType; got != "collaboration_session" {
		t.Fatalf("expected resource type %q, got %q", "collaboration_session", got)
	}
	if got := event.ResourceID; got != "session-1" {
		t.Fatalf("expected resource id %q, got %q", "session-1", got)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if got := payload["change_kind"].(string); got != "lease_claimed" {
		t.Fatalf("expected change_kind %q, got %q", "lease_claimed", got)
	}
	if got := payload["changed_user_id"].(string); got != "user-1" {
		t.Fatalf("expected changed_user_id %q, got %q", "user-1", got)
	}
	if got := payload["lock_holder_user_id"].(string); got != "user-1" {
		t.Fatalf("expected lock_holder_user_id %q, got %q", "user-1", got)
	}
	if got := payload["presence_count"].(float64); got != 2 {
		t.Fatalf("expected presence_count %d, got %v", 2, got)
	}
	if got := payload["lease_expires_at"].(string); got != leaseExpiresAt.Format(time.RFC3339) {
		t.Fatalf("expected lease_expires_at %q, got %q", leaseExpiresAt.Format(time.RFC3339), got)
	}
}

func TestPublishPreviewRuntimeUpdatedTrimsScopeAndPayloadFields(t *testing.T) {
	publisher := NewPublisher()
	occurredAt := time.Unix(300, 0).UTC()

	PublishPreviewRuntimeUpdated(context.Background(), publisher, PublishPreviewRuntimeUpdatedInput{
		ProjectID:           " project-1 ",
		EpisodeID:           " episode-1 ",
		PreviewRuntimeID:    " runtime-1 ",
		RenderStatus:        " queued ",
		RenderWorkflowRunID: " workflow-run-1 ",
		ResolvedLocale:      " en-US ",
		PlaybackAssetID:     " playback-asset-1 ",
		ExportAssetID:       " export-asset-1 ",
		OccurredAt:          occurredAt,
	})

	items := publisher.List("", "project-1", "")
	if len(items) != 1 {
		t.Fatalf("expected 1 runtime event, got %d", len(items))
	}
	event := items[0]
	if got := event.EventType; got != "project.preview.runtime.updated" {
		t.Fatalf("expected event type %q, got %q", "project.preview.runtime.updated", got)
	}
	if got := event.ProjectID; got != "project-1" {
		t.Fatalf("expected trimmed project id %q, got %q", "project-1", got)
	}
	if got := event.ResourceType; got != "preview_runtime" {
		t.Fatalf("expected resource type %q, got %q", "preview_runtime", got)
	}
	if got := event.ResourceID; got != "runtime-1" {
		t.Fatalf("expected resource id %q, got %q", "runtime-1", got)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if got := payload["episode_id"].(string); got != "episode-1" {
		t.Fatalf("expected episode_id %q, got %q", "episode-1", got)
	}
	if got := payload["render_status"].(string); got != "queued" {
		t.Fatalf("expected render_status %q, got %q", "queued", got)
	}
	if got := payload["resolved_locale"].(string); got != "en-US" {
		t.Fatalf("expected resolved_locale %q, got %q", "en-US", got)
	}
	if got := payload["occurred_at"].(string); got != occurredAt.Format(time.RFC3339) {
		t.Fatalf("expected occurred_at %q, got %q", occurredAt.Format(time.RFC3339), got)
	}
}

type stubRecorder struct {
	appendFn  func(context.Context, Event) (Event, error)
	listFn    func(context.Context, string, string, string) ([]Event, error)
	appendErr error
	listErr   error
	resetErr  error
}

func (s *stubRecorder) Append(ctx context.Context, event Event) (Event, error) {
	if s.appendFn != nil {
		return s.appendFn(ctx, event)
	}
	if s.appendErr != nil {
		return event, s.appendErr
	}
	return event, nil
}

func (s *stubRecorder) List(ctx context.Context, organizationID string, projectID string, lastEventID string) ([]Event, error) {
	if s.listFn != nil {
		return s.listFn(ctx, organizationID, projectID, lastEventID)
	}
	if s.listErr != nil {
		return nil, s.listErr
	}
	return nil, nil
}

func (s *stubRecorder) Reset(context.Context) error {
	return s.resetErr
}
