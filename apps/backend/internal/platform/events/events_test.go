package events

import (
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
