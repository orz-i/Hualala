package observability

import "log"

func Logger() *log.Logger {
	return log.Default()
}
