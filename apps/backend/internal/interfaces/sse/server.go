package sse

import "net/http"

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/sse/events", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
	})
}
