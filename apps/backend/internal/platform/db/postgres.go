package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	_ "github.com/lib/pq"
)

const defaultSnapshotStoreKey = "runtime"

type OpenStoreOptions struct {
	Driver        string
	DatabaseURL   string
	AutoMigrate   bool
	MigrationsDir string
	StoreKey      string
}

type PostgresPersister struct {
	db       *sql.DB
	storeKey string
}

func OpenStore(ctx context.Context, options OpenStoreOptions) (*MemoryStore, func() error, error) {
	switch options.Driver {
	case "", "memory":
		return NewMemoryStore(), func() error { return nil }, nil
	case "postgres":
		if options.DatabaseURL == "" {
			return nil, nil, errors.New("db: database_url is required for postgres driver")
		}

		handle, err := sql.Open("postgres", options.DatabaseURL)
		if err != nil {
			return nil, nil, fmt.Errorf("db: open postgres: %w", err)
		}
		if err := handle.PingContext(ctx); err != nil {
			_ = handle.Close()
			return nil, nil, fmt.Errorf("db: ping postgres: %w", err)
		}
		if options.AutoMigrate {
			if err := RunMigrations(ctx, handle, options.MigrationsDir); err != nil {
				_ = handle.Close()
				return nil, nil, err
			}
		}

		store, err := NewPersistentMemoryStore(ctx, NewPostgresPersister(handle, options.StoreKey))
		if err != nil {
			_ = handle.Close()
			return nil, nil, err
		}
		return store, handle.Close, nil
	default:
		return nil, nil, fmt.Errorf("db: unsupported driver %q", options.Driver)
	}
}

func NewPostgresPersister(handle *sql.DB, storeKey string) *PostgresPersister {
	if storeKey == "" {
		storeKey = defaultSnapshotStoreKey
	}
	return &PostgresPersister{
		db:       handle,
		storeKey: storeKey,
	}
}

func (p *PostgresPersister) Load(ctx context.Context) (*Snapshot, error) {
	if p == nil || p.db == nil {
		return nil, errors.New("db: postgres persister requires database handle")
	}
	var payload []byte
	err := p.db.QueryRowContext(
		ctx,
		`SELECT payload::text FROM app_state_snapshots WHERE store_key = $1`,
		p.storeKey,
	).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: load snapshot: %w", err)
	}

	var snapshot Snapshot
	if err := json.Unmarshal(payload, &snapshot); err != nil {
		return nil, fmt.Errorf("db: decode snapshot: %w", err)
	}
	return &snapshot, nil
}

func (p *PostgresPersister) Save(ctx context.Context, snapshot Snapshot) error {
	if p == nil || p.db == nil {
		return errors.New("db: postgres persister requires database handle")
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("db: encode snapshot: %w", err)
	}

	_, err = p.db.ExecContext(
		ctx,
		`INSERT INTO app_state_snapshots (store_key, payload, updated_at)
		 VALUES ($1, $2::jsonb, NOW())
		 ON CONFLICT (store_key)
		 DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
		p.storeKey,
		string(payload),
	)
	if err != nil {
		return fmt.Errorf("db: save snapshot: %w", err)
	}
	return nil
}
