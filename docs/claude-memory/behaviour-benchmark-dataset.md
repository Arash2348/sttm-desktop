---
name: behaviour-benchmark-dataset
description: "Plan (user ask Oct 13 2026) to consolidate all clips + truth into one benchmark dataset organised by the five behaviours, on Hugging Face (private/gated), with the Google Sheet as human source of record and Azure keeping raw sessions + cache"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-14T00:09:20.599Z
---

The user wants one rigorous, fast-to-run benchmark covering the five behaviours
([[five-behaviours]]), consolidated from the Google Sheet ([[verified-data-home]]), the JSON
truths and the forced-alignment outputs, usable by us and others.

Decision: Hugging Face private dataset (YouTube-sourced audio cannot be public) under the khalisfoundation org (the user is a member, confirmed Oct 13 2026); Azure keeps raw sessions and the model-output
cache ([[azure-bench-cache]]). Layout: behaviours/<1..5>/<clip>/{audio.wav, lines.csv
(verseId,start,end,conf,source=human|aligned; Jaspal's layout extended), shabads.csv, meta.json}
+ manifest.csv + README. The cached-replay harness (vf-check) reads the manifest. Sheet rows are
copied in, never edited.

Status: planned; starts after the slow-PC tiers land (ship-first rule). ~half a day of agent
work, no app change. See [[hf-dataset-compat]], [[test-small-first]].
