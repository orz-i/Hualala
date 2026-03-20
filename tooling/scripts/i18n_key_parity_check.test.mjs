import test from "node:test";
import assert from "node:assert/strict";
import {
  compareLocaleDictionaries,
  extractPlaceholders,
  flattenMessages,
} from "./i18n_key_parity_check.mjs";

test("flattenMessages flattens nested keys", () => {
  assert.deepEqual(flattenMessages({ app: { title: "Hello" } }), {
    "app.title": "Hello",
  });
});

test("extractPlaceholders returns placeholder names", () => {
  assert.deepEqual(extractPlaceholders("Budget {amount} for {projectId}"), [
    "amount",
    "projectId",
  ]);
});

test("compareLocaleDictionaries detects missing keys", () => {
  const result = compareLocaleDictionaries(
    { "app.title": "Hello", "app.subtitle": "World" },
    { "app.title": "Hello" },
  );

  assert.deepEqual(result.missingKeys, ["app.subtitle"]);
  assert.deepEqual(result.extraKeys, []);
  assert.deepEqual(result.placeholderMismatches, []);
});

test("compareLocaleDictionaries detects placeholder mismatches", () => {
  const result = compareLocaleDictionaries(
    { "budget.limit": "Budget {amount}" },
    { "budget.limit": "Budget {value}" },
  );

  assert.equal(result.missingKeys.length, 0);
  assert.equal(result.extraKeys.length, 0);
  assert.deepEqual(result.placeholderMismatches, [
    {
      key: "budget.limit",
      reference: ["amount"],
      target: ["value"],
    },
  ]);
});
