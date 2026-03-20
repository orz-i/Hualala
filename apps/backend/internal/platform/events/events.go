package events

import (
	"fmt"
	"strings"
	"sync"
	"time"
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

type Publisher struct {
	mu               sync.RWMutex
	nextID           int
	nextSubscriberID int
	records          []Event
	subscribers      map[int]subscriber
}

func NewPublisher() *Publisher {
	return &Publisher{
		subscribers: make(map[int]subscriber),
	}
}

func (p *Publisher) Publish(event Event) Event {
	if p == nil {
		return Event{}
	}

	p.mu.Lock()

	p.nextID++
	if strings.TrimSpace(event.ID) == "" {
		event.ID = fmt.Sprintf("evt-%d", p.nextID)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	p.records = append(p.records, event)
	targets := make([]chan Event, 0, len(p.subscribers))
	for _, subscription := range p.subscribers {
		if subscription.matches(event) {
			targets = append(targets, subscription.events)
		}
	}
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
	if p == nil {
		return nil
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	filtered := make([]Event, 0, len(p.records))
	reachedLastEvent := strings.TrimSpace(lastEventID) == ""
	for _, event := range p.records {
		if !reachedLastEvent {
			if event.ID == lastEventID {
				reachedLastEvent = true
			}
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

func (p *Publisher) Reset() {
	if p == nil {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.nextID = 0
	p.records = nil
	p.nextSubscriberID = 0
	p.subscribers = make(map[int]subscriber)
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
