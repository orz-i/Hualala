package connect

import (
	"net/http"

	"github.com/hualala/apps/backend/internal/application/assetapp"
)

func registerAssetRoutes(mux *http.ServeMux, deps RouteDependencies) {
	if deps.AssetService == nil {
		return
	}

	mux.HandleFunc("/connect/hualala.asset.v1.AssetService/CreateImportBatch", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[assetapp.CreateImportBatchInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.AssetService.CreateImportBatch(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapImportBatch(record))
	})

	mux.HandleFunc("/connect/hualala.asset.v1.AssetService/AddCandidateAsset", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodPost) {
			return
		}

		input, err := decodeJSONBody[assetapp.AddCandidateAssetInput](r)
		if err != nil {
			writeError(w, err)
			return
		}
		record, err := deps.AssetService.AddCandidateAsset(r.Context(), input)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mapCandidateAsset(record))
	})

	mux.HandleFunc("/connect/hualala.asset.v1.AssetService/ListCandidateAssets", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		records, err := deps.AssetService.ListCandidateAssets(r.Context(), assetapp.ListCandidateAssetsInput{
			ShotExecutionID: r.URL.Query().Get("shot_execution_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}

		assets := make([]map[string]any, 0, len(records))
		for _, record := range records {
			assets = append(assets, mapCandidateAsset(record))
		}
		writeJSON(w, http.StatusOK, map[string]any{"assets": assets})
	})

	mux.HandleFunc("/connect/hualala.asset.v1.AssetService/GetAssetProvenanceSummary", func(w http.ResponseWriter, r *http.Request) {
		if !requireMethod(w, r, http.MethodGet) {
			return
		}

		record, err := deps.AssetService.GetAssetProvenanceSummary(r.Context(), assetapp.GetAssetProvenanceSummaryInput{
			AssetID: r.URL.Query().Get("asset_id"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"asset":              mapMediaAsset(record.Asset),
			"provenance_summary": record.ProvenanceSummary,
		})
	})
}
