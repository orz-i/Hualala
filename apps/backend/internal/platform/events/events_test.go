package events

import (
	"context"
	"errors"
	"testing"
	"time"
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

func TestPublisherResetWithContextReturnsRecorderError(t *testing.T) {
	recorder := &stubRecorder{resetErr: errors.New("reset failed")}
	publisher := NewDurablePublisher(recorder)

	if err := publisher.ResetWithContext(context.Background()); err == nil {
		t.Fatal("expected ResetWithContext to surface recorder reset error")
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
