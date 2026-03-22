package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/hualala/apps/backend/internal/domain/execution"
)

type Event struct {
	ID             string
	EventType      string
	OrganizationID string
	ProjectID      string
	ResourceType   string
	ResourceID     string
	Payload        string
	CreatedAt      time.Time
}

type Recorder interface {
	Append(context.Context, Event) (Event, error)
	List(context.Context, string, string, string) ([]Event, error)
	Reset(context.Context) error
}

type Publisher struct {
	mu               sync.RWMutex
	nextID           int
	nextSubscriberID int
	records          []recordedEvent
	subscribers      map[int]subscriber
	recorder         Recorder
}

type recordedEvent struct {
	event        Event
	fallbackOnly bool
}

const durableFallbackRecordLimit = 256

func NewPublisher() *Publisher {
	return &Publisher{
		subscribers: make(map[int]subscriber),
	}
}

func NewDurablePublisher(recorder Recorder) *Publisher {
	publisher := NewPublisher()
	publisher.recorder = recorder
	return publisher
}

func (p *Publisher) Publish(event Event) Event {
	return p.PublishWithContext(context.Background(), event)
}

func (p *Publisher) PublishWithContext(ctx context.Context, event Event) Event {
	if p == nil {
		return Event{}
	}
	if ctx == nil {
		ctx = context.Background()
	}

	p.mu.Lock()
	p.nextID++
	if strings.TrimSpace(event.ID) == "" {
		event.ID = fmt.Sprintf("evt-%d", p.nextID)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	targets := make([]chan Event, 0, len(p.subscribers))
	for _, subscription := range p.subscribers {
		if subscription.matches(event) {
			targets = append(targets, subscription.events)
		}
	}
	recorder := p.recorder
	p.mu.Unlock()

	persistedDurably := false
	if recorder != nil {
		if persisted, err := recorder.Append(ctx, event); err == nil {
			event = persisted
			persistedDurably = true
		} else {
			log.Printf("events: durable append failed for %s/%s: %v", event.EventType, event.ID, err)
		}
	}

	p.mu.Lock()
	p.appendRecordLocked(event, !persistedDurably)
	p.mu.Unlock()

	for _, stream := range targets {
		select {
		case stream <- event:
		default:
			// 后续仍可通过 Last-Event-ID replay 追回，这里不阻塞发布路径。
		}
	}
	return event
}

func (p *Publisher) List(organizationID string, projectID string, lastEventID string) []Event {
	return p.ListWithContext(context.Background(), organizationID, projectID, lastEventID)
}

func (p *Publisher) ListWithContext(ctx context.Context, organizationID string, projectID string, lastEventID string) []Event {
	if p == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	p.mu.RLock()
	recorder := p.recorder
	p.mu.RUnlock()
	if recorder != nil {
		items, err := recorder.List(ctx, organizationID, projectID, lastEventID)
		if err == nil {
			p.mu.RLock()
			fallbackTail := p.listRecordedEventsLocked(organizationID, projectID, lastEventID, true)
			p.mu.RUnlock()
			return mergeReplayEvents(items, fallbackTail)
		}
		log.Printf("events: durable list failed for org=%s project=%s last=%s: %v", organizationID, projectID, lastEventID, err)
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.listRecordedEventsLocked(organizationID, projectID, lastEventID, false)
}

func (p *Publisher) Reset() {
	if err := p.ResetWithContext(context.Background()); err != nil {
		log.Printf("events: reset publisher failed: %v", err)
	}
}

func (p *Publisher) ResetWithContext(ctx context.Context) error {
	if p == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	p.mu.RLock()
	recorder := p.recorder
	p.mu.RUnlock()

	if recorder != nil {
		if err := recorder.Reset(ctx); err != nil {
			log.Printf("events: durable reset failed: %v", err)
			return err
		}
	}

	p.mu.Lock()
	p.nextID = 0
	p.records = nil
	p.nextSubscriberID = 0
	p.subscribers = make(map[int]subscriber)
	p.mu.Unlock()
	return nil
}

func (p *Publisher) Subscribe(organizationID string, projectID string) (<-chan Event, func()) {
	if p == nil {
		ch := make(chan Event)
		close(ch)
		return ch, func() {}
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.nextSubscriberID++
	subscriptionID := p.nextSubscriberID
	stream := make(chan Event, 16)
	if p.subscribers == nil {
		p.subscribers = make(map[int]subscriber)
	}
	p.subscribers[subscriptionID] = subscriber{
		organizationID: strings.TrimSpace(organizationID),
		projectID:      strings.TrimSpace(projectID),
		events:         stream,
	}

	var once sync.Once
	return stream, func() {
		once.Do(func() {
			p.mu.Lock()
			defer p.mu.Unlock()
			delete(p.subscribers, subscriptionID)
		})
	}
}

func (p *Publisher) SubscriptionCount() int {
	if p == nil {
		return 0
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	return len(p.subscribers)
}

func PublishShotExecutionUpdated(ctx context.Context, publisher *Publisher, record execution.ShotExecution, candidateAssetID string, assetID string) {
	if publisher == nil {
		return
	}

	body, err := json.Marshal(map[string]any{
		"shot_execution_id":  record.ID,
		"shot_id":            record.ShotID,
		"status":             record.Status,
		"current_run_id":     record.CurrentRunID,
		"candidate_asset_id": strings.TrimSpace(candidateAssetID),
		"asset_id":           strings.TrimSpace(assetID),
	})
	if err != nil {
		return
	}

	publisher.PublishWithContext(ctx, Event{
		EventType:      "shot.execution.updated",
		OrganizationID: strings.TrimSpace(record.OrgID),
		ProjectID:      strings.TrimSpace(record.ProjectID),
		ResourceType:   "shot_execution",
		ResourceID:     record.ID,
		Payload:        string(body),
	})
}

type subscriber struct {
	organizationID string
	projectID      string
	events         chan Event
}

func (s subscriber) matches(event Event) bool {
	if s.organizationID != "" && event.OrganizationID != s.organizationID {
		return false
	}
	if s.projectID != "" && event.ProjectID != s.projectID {
		return false
	}
	return true
}

func (p *Publisher) appendRecordLocked(event Event, fallbackOnly bool) {
	if len(p.records) < durableFallbackRecordLimit {
		p.records = append(p.records, recordedEvent{
			event:        event,
			fallbackOnly: fallbackOnly,
		})
		return
	}
	copy(p.records, p.records[1:])
	p.records[len(p.records)-1] = recordedEvent{
		event:        event,
		fallbackOnly: fallbackOnly,
	}
}

func (p *Publisher) listRecordedEventsLocked(organizationID string, projectID string, lastEventID string, fallbackOnly bool) []Event {
	filtered := make([]Event, 0, len(p.records))
	reachedLastEvent := strings.TrimSpace(lastEventID) == ""
	for _, recorded := range p.records {
		event := recorded.event
		if !reachedLastEvent {
			if event.ID == lastEventID {
				reachedLastEvent = true
			}
			continue
		}
		if fallbackOnly && !recorded.fallbackOnly {
			continue
		}
		if organizationID != "" && event.OrganizationID != organizationID {
			continue
		}
		if projectID != "" && event.ProjectID != projectID {
			continue
		}
		filtered = append(filtered, event)
	}
	return filtered
}

func mergeReplayEvents(durable []Event, fallback []Event) []Event {
	if len(fallback) == 0 {
		return durable
	}

	merged := make([]Event, 0, len(durable)+len(fallback))
	seen := make(map[string]struct{}, len(durable)+len(fallback))
	for _, event := range durable {
		merged = append(merged, event)
		seen[event.ID] = struct{}{}
	}
	for _, event := range fallback {
		if _, ok := seen[event.ID]; ok {
			continue
		}
		merged = append(merged, event)
		seen[event.ID] = struct{}{}
	}
	sort.SliceStable(merged, func(i int, j int) bool {
		if merged[i].CreatedAt.Equal(merged[j].CreatedAt) {
			return merged[i].ID < merged[j].ID
		}
		return merged[i].CreatedAt.Before(merged[j].CreatedAt)
	})
	return merged
}
