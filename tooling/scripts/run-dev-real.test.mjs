import test from "node:test";
import assert from "node:assert/strict";
import { buildManagedEnv, buildPostgresReadyCommand, defaultDatabaseUrl } from "./run-dev-real.mjs";

test("buildManagedEnv forces postgres defaults for one-command real dev", () => {
  const env = buildManagedEnv({
    PATH: "C:\\Windows\\System32",
    DB_DRIVER: "memory",
    DATABASE_URL: "postgres://wrong:wrong@127.0.0.1:5544/other",
  });

  assert.equal(env.PATH, "C:\\Windows\\System32");
  assert.equal(env.DB_DRIVER, "postgres");
  assert.equal(env.DATABASE_URL, defaultDatabaseUrl);
});

test("buildPostgresReadyCommand reuses docker compose pg_isready health probe", () => {
  assert.equal(
    buildPostgresReadyCommand(),
    "node tooling/scripts/docker_compose.mjs exec -T postgres pg_isready -U hualala -d hualala",
  );
});
