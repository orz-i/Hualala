FROM golang:1.24-bookworm AS builder

WORKDIR /src

COPY go.work go.work.sum ./
COPY apps/backend/go.mod apps/backend/go.sum ./apps/backend/
RUN go work sync && go mod download -C ./apps/backend

COPY apps ./apps
COPY infra ./infra

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/hualala-backend ./apps/backend/cmd/api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/hualala-backend-worker ./apps/backend/cmd/worker

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/backend

COPY --from=builder /out/hualala-backend /usr/local/bin/hualala-backend
COPY --from=builder /out/hualala-backend-worker /usr/local/bin/hualala-backend-worker
COPY --from=builder /src/infra /app/infra

ENV HTTP_ADDR=:8080
ENV DB_DRIVER=postgres
ENV AUTO_MIGRATE=true
ENV WORKER_POLL_INTERVAL_MS=250

EXPOSE 8080

CMD ["hualala-backend"]
