#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, ".github", "release-contract.json");

function exitWithError(message) {
  console.error(`[release-version-check] ${message}`);
  process.exit(1);
}

function readContractTagPattern(contract) {
  const rawTagPattern = contract?.releasePolicy?.tagPattern;
  if (typeof rawTagPattern !== "string" || rawTagPattern.trim() === "") {
    exitWithError("releasePolicy.tagPattern is missing in .github/release-contract.json");
  }

  try {
    return new RegExp(rawTagPattern);
  } catch (error) {
    exitWithError(`Invalid releasePolicy.tagPattern in .github/release-contract.json: ${error.message}`);
  }
}

function normalizeTag(rawTag) {
  if (typeof rawTag !== "string" || rawTag.trim() === "") {
    exitWithError("Tag input is required. Example: refs/tags/v1.2.3 or v1.2.3");
  }

  return rawTag.trim().replace(/^refs\/tags\//, "");
}

function parseTagToExpectedVersion(rawTag, tagPattern) {
  const normalizedTag = normalizeTag(rawTag);
  const match = normalizedTag.match(tagPattern);

  if (!match) {
    exitWithError(
      `Tag "${normalizedTag}" does not match releasePolicy.tagPattern. Example: refs/tags/v1.2.3 or v1.2.3`,
    );
  }

  if (match.groups && typeof match.groups.version === "string") {
    return match.groups.version;
  }

  const inferredVersion = normalizedTag.replace(/^v/, "");

  if (inferredVersion.length === 0) {
    exitWithError(`Could not normalize tag value: \"${rawTag}\"`);
  }

  return inferredVersion;
}

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    exitWithError(`Failed to read JSON file ${filePath}: ${error.message}`);
  }
}

function getValueByPath(objectValue, propertyPath, sourcePath) {
  const segments = propertyPath.split(".").filter(Boolean);
  let current = objectValue;

  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = current[segment];
    } else {
      exitWithError(
        `Path \"${propertyPath}\" not found in JSON source \"${sourcePath}\"`,
      );
    }
  }

  return String(current);
}

function readPkgbuildVariable(filePath, variableName) {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    exitWithError(`Failed to read PKGBUILD source ${filePath}: ${error.message}`);
  }

  const lines = content.split(/\r?\n/);
  const variablePattern = new RegExp(`^${variableName}=(.*)$`);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(variablePattern);
    if (!match) {
      continue;
    }

    const rawValue = match[1].trim();
    const unquoted = rawValue.replace(/^['\"]/, "").replace(/['\"]$/, "");
    return unquoted;
  }

  exitWithError(`Variable \"${variableName}\" not found in PKGBUILD source \"${filePath}\"`);
}

function resolveConfiguredSourceValue(spec) {
  const [relativePath, propertyPath] = spec.split("#");
  if (!relativePath || !propertyPath) {
    exitWithError(`Invalid configVersionPaths entry \"${spec}\". Expected format: path#property`);
  }

  const absolutePath = path.join(REPO_ROOT, relativePath);
  const extension = path.extname(relativePath).toLowerCase();

  if (extension === ".json") {
    const sourceJson = readJsonFile(absolutePath);
    return {
      spec,
      value: getValueByPath(sourceJson, propertyPath, relativePath),
    };
  }

  if (path.basename(relativePath) === "PKGBUILD") {
    return {
      spec,
      value: readPkgbuildVariable(absolutePath, propertyPath),
    };
  }

  exitWithError(`Unsupported source type for \"${spec}\". Supported: JSON files and PKGBUILD`);
}

function main() {
  const rawTag = process.argv[2] ?? process.env.GITHUB_REF ?? process.env.RELEASE_TAG;
  const contract = readJsonFile(CONTRACT_PATH);
  const configuredSources = contract?.releasePolicy?.configVersionPaths;
  const tagPattern = readContractTagPattern(contract);
  const expectedVersion = parseTagToExpectedVersion(rawTag, tagPattern);

  if (!Array.isArray(configuredSources) || configuredSources.length === 0) {
    exitWithError("releasePolicy.configVersionPaths is empty or missing in .github/release-contract.json");
  }

  const resolvedValues = configuredSources.map(resolveConfiguredSourceValue);
  const mismatches = resolvedValues.filter((entry) => entry.value !== expectedVersion);

  if (mismatches.length > 0) {
    console.error(
      `[release-version-check] FAIL-FAST: version mismatch for release tag \"${rawTag}\" (version: \"${expectedVersion}\")`,
    );
    for (const mismatch of mismatches) {
      console.error(
        `[release-version-check] MISMATCH ${mismatch.spec}: expected \"${expectedVersion}\", actual \"${mismatch.value}\"`,
      );
    }
    process.exit(1);
  }

  console.log(
    `[release-version-check] OK: all ${resolvedValues.length} configured version sources match \"${expectedVersion}\"`,
  );
}

main();
