#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, ".github", "release-contract.json");
const LOG_PREFIX = "[release-smoke]";

function printUsage() {
  console.log("Usage: node scripts/release-smoke-verify.mjs [tag] [--repo owner/name] [--gh-bin <path>]");
  console.log("       node scripts/release-smoke-verify.mjs --tag v1.2.3 [--repo owner/name] [--gh-bin <path>]");
  console.log("       node scripts/release-smoke-verify.mjs --tag v1.2.3 --gh-node-script ./mock-gh.js");
}

function exitWithError(message) {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    exitWithError(`Failed to read JSON file ${filePath}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const parsed = {
    tag: null,
    repo: null,
    ghBin: "gh",
    ghNodeScript: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    if (token === "--tag") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        exitWithError("Missing value for --tag");
      }
      parsed.tag = value;
      index += 1;
      continue;
    }

    if (token === "--repo") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        exitWithError("Missing value for --repo");
      }
      parsed.repo = value;
      index += 1;
      continue;
    }

    if (token === "--gh-bin") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        exitWithError("Missing value for --gh-bin");
      }
      parsed.ghBin = value;
      index += 1;
      continue;
    }

    if (token === "--gh-node-script") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        exitWithError("Missing value for --gh-node-script");
      }
      parsed.ghNodeScript = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      exitWithError(`Unknown option: ${token}`);
    }

    if (parsed.tag !== null) {
      exitWithError(`Unexpected positional argument: ${token}`);
    }
    parsed.tag = token;
  }

  return parsed;
}

function getGhInvocation(ghConfig, args) {
  if (ghConfig.ghNodeScript) {
    return {
      command: "node",
      commandArgs: [ghConfig.ghNodeScript, ...args],
    };
  }

  return {
    command: ghConfig.ghBin,
    commandArgs: args,
  };
}

function runGhJson(ghConfig, args, contextLabel) {
  const invocation = getGhInvocation(ghConfig, args);
  try {
    const stdout = execFileSync(invocation.command, invocation.commandArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(stdout);
  } catch (error) {
    const stderr = String(error?.stderr ?? "").trim();
    exitWithError(`${contextLabel} failed. ${stderr || error.message}`);
  }
}

function runGhText(ghConfig, args, contextLabel) {
  const invocation = getGhInvocation(ghConfig, args);
  try {
    return execFileSync(invocation.command, invocation.commandArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = String(error?.stderr ?? "").trim();
    exitWithError(`${contextLabel} failed. ${stderr || error.message}`);
  }
}

function normalizeTag(rawTag) {
  if (typeof rawTag !== "string" || rawTag.trim() === "") {
    return null;
  }
  return rawTag.trim().replace(/^refs\/tags\//, "");
}

function renderFileNameTemplate(template, values) {
  const rendered = template.replace(/\{(\w+)\}/g, (_, token) => {
    const replacement = values[token];
    if (typeof replacement !== "string" || replacement === "") {
      exitWithError(`Missing value for template token "${token}" in "${template}"`);
    }
    return replacement;
  });

  if (/\{\w+\}/.test(rendered)) {
    exitWithError(`Unresolved token in rendered template "${rendered}"`);
  }

  return rendered;
}

function resolveRepo(overrideRepo, ghConfig) {
  if (overrideRepo) {
    return overrideRepo;
  }

  const repoView = runGhJson(ghConfig, ["repo", "view", "--json", "nameWithOwner"], "gh repo view");
  const resolved = repoView?.nameWithOwner;
  if (typeof resolved !== "string" || resolved.length === 0) {
    exitWithError("Could not resolve repository from gh repo view");
  }

  return resolved;
}

function resolveTag(explicitTag, repo, ghConfig) {
  const normalizedExplicitTag = normalizeTag(explicitTag);
  if (normalizedExplicitTag) {
    return {
      tag: normalizedExplicitTag,
      source: "argument",
    };
  }

  const releases = runGhJson(
    ghConfig,
    ["api", `repos/${repo}/releases?per_page=100`],
    "gh api releases list",
  );
  const candidate = releases.find((release) => {
    return release && release.draft === false && typeof release.tag_name === "string" && release.tag_name.startsWith("v");
  });

  if (!candidate) {
    exitWithError("No non-draft release with a v* tag was found. Pass --tag explicitly.");
  }

  return {
    tag: normalizeTag(candidate.tag_name),
    source: "latest-v-release",
  };
}

function getReleaseRunForTag(repo, tag, ghConfig) {
  const direct = runGhJson(
    ghConfig,
    [
      "api",
      `repos/${repo}/actions/workflows/release.yml/runs?event=push&branch=${encodeURIComponent(tag)}&per_page=30`,
    ],
    "gh api workflow runs (tag filter)",
  );

  const directMatch = (direct.workflow_runs ?? []).find((run) => run?.head_branch === tag);
  if (directMatch) {
    return directMatch;
  }

  const fallback = runGhJson(
    ghConfig,
    ["api", `repos/${repo}/actions/workflows/release.yml/runs?event=push&per_page=100`],
    "gh api workflow runs (fallback)",
  );
  return (fallback.workflow_runs ?? []).find((run) => run?.head_branch === tag) ?? null;
}

function parseChecksums(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed = [];

  for (const line of lines) {
    const match = line.match(/^([a-fA-F0-9]{64})\s{2}(.+)$/);
    if (!match) {
      parsed.push({ invalid: true, raw: line });
      continue;
    }

    parsed.push({
      invalid: false,
      checksum: match[1].toLowerCase(),
      fileName: match[2],
    });
  }

  return parsed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const contract = readJsonFile(CONTRACT_PATH);
  const tagPatternRaw = contract?.releasePolicy?.tagPattern;
  if (typeof tagPatternRaw !== "string" || tagPatternRaw.trim() === "") {
    exitWithError("releasePolicy.tagPattern is missing in .github/release-contract.json");
  }

  const ghConfig = {
    ghBin: args.ghBin,
    ghNodeScript: args.ghNodeScript,
  };

  const repo = resolveRepo(args.repo, ghConfig);
  const { tag, source } = resolveTag(args.tag, repo, ghConfig);
  const tagPattern = new RegExp(tagPatternRaw);
  const tagMatch = tag.match(tagPattern);
  if (!tagMatch) {
    exitWithError(`Tag "${tag}" does not match releasePolicy.tagPattern`);
  }

  const version = tagMatch.groups?.version ?? tag.replace(/^v/, "");
  const expectedPrerelease = version.includes("-");

  const requiredAssets = contract?.requiredAssets;
  if (!Array.isArray(requiredAssets) || requiredAssets.length === 0) {
    exitWithError("requiredAssets is empty or missing in .github/release-contract.json");
  }

  const expectedAssetNames = requiredAssets.map((asset) => {
    if (typeof asset?.fileName !== "string" || typeof asset?.id !== "string") {
      exitWithError("Each requiredAssets entry must include string id and fileName");
    }
    return {
      id: asset.id,
      fileName: renderFileNameTemplate(asset.fileName, {
        version,
        platform: asset.platform,
        arch: asset.arch,
      }),
    };
  });

  const expectedById = new Map(expectedAssetNames.map((asset) => [asset.id, asset.fileName]));
  const expectedNamesSorted = expectedAssetNames.map((asset) => asset.fileName).sort();

  console.log(`${LOG_PREFIX} repo=${repo}`);
  console.log(`${LOG_PREFIX} tag=${tag} (source=${source})`);

  const release = runGhJson(ghConfig, ["api", `repos/${repo}/releases/tags/${tag}`], `gh api release lookup for ${tag}`);
  const releaseRun = getReleaseRunForTag(repo, tag, ghConfig);
  const actualAssetNames = (release.assets ?? []).map((asset) => asset.name).sort();
  const checksumsName = expectedById.get("checksums");
  const checksumsAsset = (release.assets ?? []).find((asset) => asset.name === checksumsName);

  const errors = [];

  if (release.prerelease !== expectedPrerelease) {
    errors.push(
      `prerelease mismatch: expected ${expectedPrerelease} from tag ${tag}, got ${release.prerelease}`,
    );
  }

  if (!releaseRun) {
    errors.push(`no release workflow run found for tag ${tag}`);
  } else {
    if (releaseRun.status !== "completed") {
      errors.push(`release workflow run is not completed (status=${releaseRun.status})`);
    }
    if (releaseRun.conclusion !== "success") {
      errors.push(`release workflow run conclusion is ${releaseRun.conclusion}, expected success`);
    }
  }

  if (actualAssetNames.length !== expectedNamesSorted.length) {
    errors.push(
      `release asset count mismatch: expected ${expectedNamesSorted.length}, got ${actualAssetNames.length}`,
    );
  }

  for (let index = 0; index < Math.max(actualAssetNames.length, expectedNamesSorted.length); index += 1) {
    const expected = expectedNamesSorted[index];
    const actual = actualAssetNames[index];
    if (expected !== actual) {
      errors.push(
        `asset set mismatch at index ${index}: expected "${expected ?? "<none>"}", got "${actual ?? "<none>"}"`,
      );
    }
  }

  const wildcardCounts = {
    msi: actualAssetNames.filter((name) => name.endsWith(".msi")).length,
    deb: actualAssetNames.filter((name) => name.endsWith(".deb")).length,
    arch: actualAssetNames.filter((name) => name.endsWith(".pkg.tar.zst")).length,
  };

  if (wildcardCounts.msi !== 1) {
    errors.push(`expected exactly one .msi asset, found ${wildcardCounts.msi}`);
  }
  if (wildcardCounts.deb !== 1) {
    errors.push(`expected exactly one .deb asset, found ${wildcardCounts.deb}`);
  }
  if (wildcardCounts.arch !== 1) {
    errors.push(`expected exactly one .pkg.tar.zst asset, found ${wildcardCounts.arch}`);
  }

  if (!actualAssetNames.includes("PKGBUILD")) {
    errors.push("missing PKGBUILD asset");
  }
  if (!actualAssetNames.includes("SHA256SUMS")) {
    errors.push("missing SHA256SUMS asset");
  }

  if (!checksumsAsset) {
    errors.push("cannot validate checksum coverage because SHA256SUMS is missing");
  } else {
    const checksumText = runGhText(
      ghConfig,
      ["api", "-H", "Accept: application/octet-stream", `repos/${repo}/releases/assets/${checksumsAsset.id}`],
      "gh api checksum download",
    );

    const parsedChecksums = parseChecksums(checksumText);
    const invalidLines = parsedChecksums.filter((entry) => entry.invalid);
    if (invalidLines.length > 0) {
      errors.push(`SHA256SUMS contains ${invalidLines.length} invalid line(s)`);
    } else {
      const entries = parsedChecksums;
      const publishedAssets = actualAssetNames.filter((name) => name !== checksumsName).sort();
      const checksumAssets = entries.map((entry) => entry.fileName).sort();
      const uniqueChecksumAssets = new Set(checksumAssets);

      if (entries.length !== publishedAssets.length) {
        errors.push(`SHA256SUMS line count mismatch: expected ${publishedAssets.length}, got ${entries.length}`);
      }

      if (uniqueChecksumAssets.size !== entries.length) {
        errors.push("SHA256SUMS contains duplicate asset entries");
      }

      for (let index = 0; index < Math.max(publishedAssets.length, checksumAssets.length); index += 1) {
        const expected = publishedAssets[index];
        const actual = checksumAssets[index];
        if (expected !== actual) {
          errors.push(
            `SHA256SUMS coverage mismatch at index ${index}: expected "${expected ?? "<none>"}", got "${actual ?? "<none>"}"`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(`${LOG_PREFIX} FAILED (${errors.length} issue${errors.length === 1 ? "" : "s"})`);
    for (const error of errors) {
      console.error(`${LOG_PREFIX} - ${error}`);
    }
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} release prerelease=${release.prerelease}`);
  console.log(
    `${LOG_PREFIX} workflow run id=${releaseRun.id} status=${releaseRun.status} conclusion=${releaseRun.conclusion}`,
  );
  console.log(`${LOG_PREFIX} assets=${actualAssetNames.join(", ")}`);
  console.log(`${LOG_PREFIX} checksum coverage verified for ${actualAssetNames.length - 1} asset(s)`);
  console.log(`${LOG_PREFIX} PASS`);
}

main();
