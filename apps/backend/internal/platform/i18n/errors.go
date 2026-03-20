package i18n

type ErrorPayload struct {
	ErrorCode     string            `json:"error_code"`
	MessageKey    string            `json:"message_key"`
	MessageParams map[string]string `json:"message_params,omitempty"`
}
