package connect

import (
	"net/http"

	"slices"

	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/interfaces/upload"
)

var allowedHealthMethods = []string{http.MethodGet}

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !slices.Contains(allowedHealthMethods, r.Method) {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	sse.RegisterRoutes(mux)
	upload.RegisterRoutes(mux)
}
