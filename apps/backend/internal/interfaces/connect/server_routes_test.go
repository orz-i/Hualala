package connect

import "testing"

func TestServerRouteDependenciesDoNotExposeRawMemoryStore(t *testing.T) {
	testServerRouteDependenciesDoNotExposeRawMemoryStore(t)
}

func TestCmdAPIAvoidsRepositorySetConstruction(t *testing.T) {
	testCmdAPIAvoidsRepositorySetConstruction(t)
}
