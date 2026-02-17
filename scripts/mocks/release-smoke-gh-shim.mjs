#!/usr/bin/env node

const args = process.argv.slice(2);

const REPO = "example/kitsune";
const TAG = "v1.2.3";

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeChecksums() {
  process.stdout.write("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  PKGBUILD\n");
  process.stdout.write("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  kitsune-dm-v1.2.3-linux-amd64.deb\n");
  process.stdout.write("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc  kitsune-dm-v1.2.3-linux-x86_64.pkg.tar.zst\n");
  process.stdout.write("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd  kitsune-dm-v1.2.3-windows-x64.msi\n");
}

function releasePayload() {
  return {
    tag_name: TAG,
    prerelease: false,
    draft: false,
    assets: [
      { id: 1, name: "kitsune-dm-v1.2.3-linux-amd64.deb" },
      { id: 2, name: "kitsune-dm-v1.2.3-windows-x64.msi" },
      { id: 3, name: "PKGBUILD" },
      { id: 4, name: "kitsune-dm-v1.2.3-linux-x86_64.pkg.tar.zst" },
      { id: 9001, name: "SHA256SUMS" },
    ],
  };
}

if (args[0] === "repo" && args[1] === "view") {
  writeJson({ nameWithOwner: REPO });
  process.exit(0);
}

if (args[0] === "api") {
  const target = args[args.length - 1];

  if (target === `repos/${REPO}/releases?per_page=100`) {
    writeJson([releasePayload()]);
    process.exit(0);
  }

  if (target === `repos/${REPO}/releases/tags/${TAG}`) {
    writeJson(releasePayload());
    process.exit(0);
  }

  if (target.startsWith(`repos/${REPO}/actions/workflows/release.yml/runs?event=push&branch=`)) {
    writeJson({
      workflow_runs: [{ id: 777, status: "completed", conclusion: "success", head_branch: TAG }],
    });
    process.exit(0);
  }

  if (target === `repos/${REPO}/actions/workflows/release.yml/runs?event=push&per_page=100`) {
    writeJson({ workflow_runs: [] });
    process.exit(0);
  }

  if (target === `repos/${REPO}/releases/assets/9001`) {
    writeChecksums();
    process.exit(0);
  }
}

process.stderr.write(`[release-smoke-gh-shim] unsupported invocation: ${args.join(" ")}\n`);
process.exit(1);
