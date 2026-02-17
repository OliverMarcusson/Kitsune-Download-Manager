#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "release.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");
const validateScriptPath = path.join(process.cwd(), "scripts", "validate-release-config-version.mjs");
const validateScript = fs.readFileSync(validateScriptPath, "utf8");

function assertContains(snippet, label) {
  if (!workflow.includes(snippet)) {
    throw new Error(`Missing ${label}`);
  }
}

function assertNotContains(snippet, label) {
  if (workflow.includes(snippet)) {
    throw new Error(`Unexpected ${label}`);
  }
}

function assertOrder(firstSnippet, secondSnippet, label) {
  const firstIndex = workflow.indexOf(firstSnippet);
  const secondIndex = workflow.indexOf(secondSnippet);
  if (firstIndex === -1 || secondIndex === -1) {
    throw new Error(`Cannot verify order for ${label}`);
  }
  if (firstIndex >= secondIndex) {
    throw new Error(`Invalid order for ${label}`);
  }
}

function assertScriptContains(snippet, label) {
  if (!validateScript.includes(snippet)) {
    throw new Error(`Missing ${label}`);
  }
}

assertContains("guardrails:\n    name: Guardrails", "guardrails job");
assertContains("Validate configured versions against tag", "guardrails version validation step");
assertContains("run: node scripts/validate-release-config-version.mjs \"${GITHUB_REF}\"", "guardrails version validation command");
assertContains("Detect prerelease from tag", "guardrails prerelease detection step");
assertOrder(
  "- name: Validate configured versions against tag",
  "- name: Detect prerelease from tag",
  "guardrails fail-fast validation before prerelease detection",
);

assertContains("publish_fan_in:\n    name: Publish raw artifact fan-in", "publish_fan_in job");
assertContains(
  "needs: [guardrails, build_windows_msi, build_linux_deb, build_linux_arch]",
  "publish_fan_in needs guardrails and all build jobs",
);
assertContains("name: windows-msi-raw\n          path: dist/raw/windows-msi-raw", "Windows fan-in download path");
assertContains("name: linux-deb-raw\n          path: dist/raw/linux-deb-raw", "Debian fan-in download path");
assertContains("name: arch-pkgbuild-raw\n          path: dist/raw/arch-pkgbuild-raw", "PKGBUILD fan-in download path");
assertContains(
  "name: linux-arch-pkg-tar-zst-raw\n          path: dist/raw/linux-arch-pkg-tar-zst-raw",
  "Arch package fan-in download path",
);
assertContains("name: publish-raw-assets-fan-in\n          path: dist/raw", "fan-in upload artifact");
assertContains("publish_prepare:\n    name: Publish asset preparation", "publish_prepare job");
assertContains("needs: [guardrails, build_matrix, publish_fan_in]", "publish_prepare needs fan-in wiring");
assertContains("name: publish-raw-assets-fan-in\n          path: dist/raw", "publish_prepare fan-in artifact download");
assertContains("build_windows_msi:\n    name: Build Windows MSI\n    needs: guardrails", "windows build depends on guardrails");
assertContains("build_linux_deb:\n    name: Build Linux Debian package\n    needs: guardrails", "debian build depends on guardrails");
assertContains("build_linux_arch:\n    name: Build Linux Arch package\n    needs: guardrails", "arch build depends on guardrails");
assertContains("Expected exactly one Debian artifact", "Debian deterministic single-artifact guard");
assertContains("Expected exactly one Arch package artifact", "Arch deterministic single-artifact guard");
assertContains(
  "node scripts/normalize-release-assets.mjs --tag \"${{ needs.guardrails.outputs.tag }}\" --input-dir dist/raw --output-dir dist/publish",
  "publish normalization command",
);
assertContains("name: publish-assets-normalized\n          path: dist/publish", "normalized upload artifact");
assertContains("publish:\n    name: Publish GitHub release assets", "publish release job");
assertContains("needs: [guardrails, publish_prepare]", "publish depends on publish_prepare");
assertContains("contents: write", "publish write permission");
assertContains("name: publish-assets-normalized\n          path: dist/publish", "publish normalized artifact download");
assertContains("Expected exactly one MSI in dist/publish", "MSI required asset assertion");
assertContains("Expected exactly one Debian package in dist/publish", "Debian required asset assertion");
assertContains("Expected exactly one Arch package in dist/publish", "Arch required asset assertion");
assertContains("Missing PKGBUILD in dist/publish", "PKGBUILD required asset assertion");
assertContains("Missing SHA256SUMS in dist/publish", "SHA256SUMS required asset assertion");
assertContains("gh api --method PATCH \"/repos/${repo}/releases/${release_id}\"", "release patch command");
assertContains("gh api --method POST \"/repos/${repo}/releases\"", "release create command");
assertContains("Assert publish asset set is deterministic", "deterministic publish asset step");
assertContains("Expected exactly 5 publish assets", "deterministic publish asset count assertion");
assertContains("Publish directory has unexpected extra/missing files", "publish directory mismatch assertion");
assertContains("Remove unmanaged existing release assets before upload", "unmanaged asset cleanup step");
assertContains("Deleting unmanaged existing release asset:", "unmanaged release asset deletion log");
assertContains("gh release upload \"${tag}\" dist/publish/* --clobber", "idempotent asset upload command");
assertContains("Assert release assets exactly match normalized publish set", "release asset post-upload assertion step");
assertContains("Release asset count mismatch for ${tag}", "release asset count mismatch assertion");
assertContains("Release asset mismatch at index $i", "release asset ordering assertion");
assertScriptContains("Tag \"${normalizedTag}\" does not match releasePolicy.tagPattern", "invalid tag fail-fast message");
assertScriptContains("FAIL-FAST: version mismatch for release tag", "version mismatch fail-fast message");

assertNotContains("softprops/action-gh-release", "GitHub release publish action");
assertNotContains("Release publish intentionally disabled in this task", "publish placeholder block");

console.log("release fail-fast and fan-in assertions passed");
