#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, ".github", "release-contract.json");

function exitWithError(message) {
  console.error(`[release-assets] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      exitWithError(`Missing value for argument "${token}"`);
    }

    result[key] = value;
    index += 1;
  }
  return result;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    exitWithError(`Failed to parse JSON file ${filePath}: ${error.message}`);
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const pending = [rootDir];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function normalizeTag(rawTag) {
  if (typeof rawTag !== "string" || rawTag.trim() === "") {
    exitWithError("Tag input is required. Example: refs/tags/v1.2.3 or v1.2.3");
  }
  return rawTag.trim().replace(/^refs\/tags\//, "");
}

function getVersionFromTag(tag, contract) {
  const tagPatternRaw = contract?.releasePolicy?.tagPattern;
  if (typeof tagPatternRaw !== "string" || tagPatternRaw.trim() === "") {
    exitWithError("releasePolicy.tagPattern is missing in .github/release-contract.json");
  }

  const tagPattern = new RegExp(tagPatternRaw);
  const match = tag.match(tagPattern);
  if (!match) {
    exitWithError(`Tag "${tag}" does not match releasePolicy.tagPattern`);
  }

  if (match.groups && typeof match.groups.version === "string" && match.groups.version) {
    return match.groups.version;
  }

  return tag.replace(/^v/, "");
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

function findSingleSourceFile(assetId, searchDir, matcher) {
  const matches = listFilesRecursively(searchDir).filter((filePath) => matcher(path.basename(filePath)));
  if (matches.length === 0) {
    exitWithError(`Missing raw artifact for "${assetId}" in ${searchDir}`);
  }
  if (matches.length > 1) {
    const formatted = matches.map((entry) => `- ${entry}`).join("\n");
    exitWithError(`Found multiple raw artifacts for "${assetId}"; expected exactly one:\n${formatted}`);
  }
  return matches[0];
}

function resolveRawAssetPath(assetId, inputDir) {
  if (assetId === "windows-msi") {
    return findSingleSourceFile(assetId, path.join(inputDir, "windows-msi-raw"), (name) => name.endsWith(".msi"));
  }

  if (assetId === "linux-deb") {
    return findSingleSourceFile(assetId, path.join(inputDir, "linux-deb-raw"), (name) => name.endsWith(".deb"));
  }

  if (assetId === "arch-pkgbuild") {
    return findSingleSourceFile(assetId, path.join(inputDir, "arch-pkgbuild-raw"), (name) => name === "PKGBUILD");
  }

  if (assetId === "arch-package") {
    return findSingleSourceFile(assetId, path.join(inputDir, "linux-arch-pkg-tar-zst-raw"), (name) =>
      name.endsWith(".pkg.tar.zst"),
    );
  }

  exitWithError(`No raw artifact resolver configured for required asset id "${assetId}"`);
}

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function validateChecksumCoverage(publishAssets, checksumLines, checksumPolicy) {
  if (checksumPolicy?.requiredForAllAssets !== true) {
    return;
  }

  if (checksumLines.length !== publishAssets.length) {
    exitWithError(
      `Checksum coverage mismatch: expected ${publishAssets.length} lines, got ${checksumLines.length}`,
    );
  }

  for (const asset of publishAssets) {
    const expectedSuffix = `  ${asset.fileName}`;
    if (!checksumLines.some((line) => line.endsWith(expectedSuffix))) {
      exitWithError(`Missing checksum entry for normalized asset "${asset.fileName}"`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawTag = args.tag ?? process.env.GITHUB_REF ?? process.env.RELEASE_TAG;
  const inputDir = path.resolve(REPO_ROOT, args["input-dir"] ?? "dist/raw");
  const outputDir = path.resolve(REPO_ROOT, args["output-dir"] ?? "dist/publish");

  const contract = readJsonFile(CONTRACT_PATH);
  const normalizedTag = normalizeTag(rawTag);
  const version = getVersionFromTag(normalizedTag, contract);
  const requiredAssets = contract?.requiredAssets;

  if (!Array.isArray(requiredAssets) || requiredAssets.length === 0) {
    exitWithError("requiredAssets is empty or missing in .github/release-contract.json");
  }

  const checksumPolicy = contract?.checksumPolicy;
  if ((checksumPolicy?.algorithm ?? "").toLowerCase() !== "sha256") {
    exitWithError("Only sha256 checksumPolicy.algorithm is supported");
  }

  ensureDirectory(outputDir);

  const publishAssets = [];
  for (const asset of requiredAssets) {
    if (asset.id === "checksums") {
      continue;
    }

    if (typeof asset.id !== "string" || typeof asset.fileName !== "string") {
      exitWithError("Each requiredAssets entry must include string id and fileName");
    }

    const sourcePath = resolveRawAssetPath(asset.id, inputDir);
    const normalizedName = renderFileNameTemplate(asset.fileName, {
      version,
      platform: asset.platform,
      arch: asset.arch,
    });
    const destinationPath = path.join(outputDir, normalizedName);

    fs.copyFileSync(sourcePath, destinationPath);
    publishAssets.push({
      id: asset.id,
      fileName: normalizedName,
      absolutePath: destinationPath,
      sourcePath,
    });
  }

  const checksumsAsset = requiredAssets.find((asset) => asset.id === "checksums");
  if (!checksumsAsset || typeof checksumsAsset.fileName !== "string") {
    exitWithError("requiredAssets must include checksums entry with fileName");
  }

  const checksumLines = publishAssets.map((asset) => {
    const digest = computeSha256(asset.absolutePath);
    return `${digest}  ${asset.fileName}`;
  });
  validateChecksumCoverage(publishAssets, checksumLines, checksumPolicy);
  fs.writeFileSync(path.join(outputDir, checksumsAsset.fileName), `${checksumLines.join("\n")}\n`, "utf8");

  console.log(`[release-assets] tag=${normalizedTag} version=${version}`);
  for (const asset of publishAssets) {
    console.log(`[release-assets] normalized ${asset.id}: ${path.basename(asset.sourcePath)} -> ${asset.fileName}`);
  }
  console.log(`[release-assets] wrote ${checksumsAsset.fileName} with ${checksumLines.length} entries`);
}

main();
