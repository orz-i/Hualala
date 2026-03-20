import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function flattenMessages(messages, prefix = "") {
  return Object.entries(messages).reduce((result, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(result, flattenMessages(value, nextKey));
      return result;
    }

    result[nextKey] = String(value);
    return result;
  }, {});
}

export function extractPlaceholders(template) {
  return [...String(template).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

export function compareLocaleDictionaries(referenceMessages, targetMessages) {
  const reference = flattenMessages(referenceMessages);
  const target = flattenMessages(targetMessages);
  const referenceKeys = Object.keys(reference).sort();
  const targetKeys = Object.keys(target).sort();
  const missingKeys = referenceKeys.filter((key) => !(key in target));
  const extraKeys = targetKeys.filter((key) => !(key in reference));
  const placeholderMismatches = referenceKeys.flatMap((key) => {
    if (!(key in target)) {
      return [];
    }

    const referencePlaceholders = extractPlaceholders(reference[key]);
    const targetPlaceholders = extractPlaceholders(target[key]);
    return referencePlaceholders.join("|") === targetPlaceholders.join("|")
      ? []
      : [
          {
            key,
            reference: referencePlaceholders,
            target: targetPlaceholders,
          },
        ];
  });

  return {
    missingKeys,
    extraKeys,
    placeholderMismatches,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatIssues(appName, comparison) {
  const lines = [];
  for (const key of comparison.missingKeys) {
    lines.push(`[${appName}] missing key: ${key}`);
  }
  for (const key of comparison.extraKeys) {
    lines.push(`[${appName}] extra key: ${key}`);
  }
  for (const mismatch of comparison.placeholderMismatches) {
    lines.push(
      `[${appName}] placeholder mismatch: ${mismatch.key} expected {${mismatch.reference.join(",")}} got {${mismatch.target.join(",")}}`,
    );
  }
  return lines;
}

export function runParityCheck(repoRoot) {
  const targets = [
    {
      appName: "admin",
      zhPath: path.join(repoRoot, "apps/admin/src/i18n/zh-CN.json"),
      enPath: path.join(repoRoot, "apps/admin/src/i18n/en-US.json"),
    },
    {
      appName: "creator",
      zhPath: path.join(repoRoot, "apps/creator/src/i18n/zh-CN.json"),
      enPath: path.join(repoRoot, "apps/creator/src/i18n/en-US.json"),
    },
  ];

  const issues = targets.flatMap((target) =>
    formatIssues(
      target.appName,
      compareLocaleDictionaries(readJson(target.zhPath), readJson(target.enPath)),
    ),
  );

  return {
    ok: issues.length === 0,
    issues,
  };
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedPath === currentFilePath) {
  const repoRoot = path.resolve(path.dirname(currentFilePath), "../..");
  const result = runParityCheck(repoRoot);
  if (!result.ok) {
    console.error("i18n key parity check failed");
    for (const issue of result.issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("i18n key parity check passed");
}
