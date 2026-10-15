---
name: session-versioning
description: Every uploaded Voice-Follow session records feature version + build commit (branch vf-session-version a700366f); bump VF_FEATURE_VERSION in shadow/config.js with every merged Voice-Follow PR
metadata:
  type: project
---

User ask (Oct 13 2026): Azure uploads must say which version of the feature made them, now that
PRs merge into experimental-release. Branch vf-session-version (a700366f, on the fork, not a PR
yet): shadow/config.js VF_FEATURE_VERSION = '9.0.1' + VF_BUILD_COMMIT placeholder stamped after
build by packaging/inject-upload-sas.js (GITHUB_SHA in CI, git HEAD locally; works without the
SAS); session.json now has build "vf-<version>" and feature {version, commit} (commit 'dev' when
unstamped); stale 'mvp-8.6c-shadow' label removed. fleet-report.js shows it (3f7bb6c8).

**How to apply:** every Voice-Follow PR bumps VF_FEATURE_VERSION (9.0.1 -> 9.0.2 / 9.1 ...);
ride this branch into the next PR. See [[azure-bench-cache]], [[adaptive-performance]].
