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
	mu      sync.RWMutex
	nextID  int
	records []Event
}

func NewPublisher() *Publisher {
	return &Publisher{}
}

func (p *Publisher) Publish(event Event) Event {
	if p == nil {
		return Event{}
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.nextID++
	if strings.TrimSpace(event.ID) == "" {
		event.ID = fmt.Sprintf("evt-%d", p.nextID)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	p.records = append(p.records, event)
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
}
