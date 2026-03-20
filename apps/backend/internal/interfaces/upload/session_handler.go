package upload

import "net/http"

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/upload/sessions", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
	})
}
