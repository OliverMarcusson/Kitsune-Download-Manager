#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, ".github", "release-contract.json");

function exitWithError(message) {
  console.error(`[release-prerelease-check] ${message}`);
  process.exit(1);
}

function readContractTagPattern() {
  try {
    const contractRaw = fs.readFileSync(CONTRACT_PATH, "utf8");
    const contract = JSON.parse(contractRaw);
    const tagPattern = contract?.releasePolicy?.tagPattern;
    if (typeof tagPattern !== "string" || tagPattern.trim() === "") {
      exitWithError("releasePolicy.tagPattern is missing in .github/release-contract.json");
    }
    return new RegExp(tagPattern);
  } catch (error) {
    exitWithError(`Failed to load tag pattern from .github/release-contract.json: ${error.message}`);
  }
}

function normalizeTag(rawTag) {
  if (typeof rawTag !== "string" || rawTag.trim() === "") {
    exitWithError("Tag input is required. Example: refs/tags/v1.2.3 or v1.2.3");
  }

  return rawTag.trim().replace(/^refs\/tags\//, "");
}

function getTagVersion(normalizedTag, tagPattern) {
  const match = normalizedTag.match(tagPattern);
  if (!match) {
    exitWithError(`Tag \"${normalizedTag}\" does not match releasePolicy.tagPattern`);
  }

  if (match.groups && typeof match.groups.version === "string") {
    return match.groups.version;
  }

  return normalizedTag.replace(/^v/, "");
}

function main() {
  const rawTag = process.argv[2] ?? process.env.GITHUB_REF ?? process.env.RELEASE_TAG;
  const normalizedTag = normalizeTag(rawTag);
  const tagPattern = readContractTagPattern();
  const version = getTagVersion(normalizedTag, tagPattern);
  const isPrerelease = version.includes("-");

  console.log(`prerelease=${isPrerelease}`);
  console.error(
    `[release-prerelease-check] ${normalizedTag} -> ${isPrerelease ? "prerelease" : "stable"}`,
  );
}

main();
