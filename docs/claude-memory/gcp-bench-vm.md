---
name: gcp-bench-vm
description: "GCP project vf-bench-sttm (user's account, $300 credit to Jan 11 2027) for benchmark recording; VM vf-record n2-standard-32 us-east1-b; $150 budget + billing kill-switch; quota 32 cores; how to resize/stop; user is afraid of overspend"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T07:19:48.710Z
---

Set up Oct 13 2026 at the user's request ("do everything for me"). The user was burned by an
AWS bill before and wants hard protection.

- Billing account 0104D4-4CBF24-B50233; credit: $300 one-time, 100% left, valid to 2027-01-11
  (upgraded from trial; the old trial credit row shows "Expired", that is normal).
- Project `vf-bench-sttm` (the only one I created; the others on the account pre-existed).
- Protection: budget "vf-bench cap 150" ($150, alerts 50/90/100%) -> Pub/Sub budget-alerts ->
  Cloud Function `budget-killswitch` (us-central1) detaches billing at 100% (tested with a
  below-cap message; function SA has billing.admin). Every VM gets --max-run-duration=6h
  --instance-termination-action=STOP.
- Quota: CPUS_ALL_REGIONS raised 12 -> 32 (96 was auto-denied). C3 family is 8/region, so use N2.
  Trick if more is needed: the cap is per project, so extra projects under the same billing
  account each get their own 12 (orchestrate by clip; cache lives in Azure anyway).
- VM `vf-record`: n2-standard-32, us-east1-b (us-central1 had no capacity), Debian 12, 200 GB,
  ~$1.55/h. Resize: stop -> `gcloud compute instances set-machine-type` -> start. Stopped VM
  costs only disk (~$20/mo for 200 GB). ALWAYS stop it after a job.
- gcloud at ~/google-cloud-sdk/bin/gcloud (user logged in + ADC done); gcloud MCP server and
  google-cloud-developer plugin installed for new sessions.

**Standing permission (user, Oct 14 2026):** "please feel free to use the GCP as needed... take full
advantage of it for everything we do". No need to ask per job. Guardrails UNCHANGED: $150 cap +
kill-switch stay (do not raise; ask if a plan needs more), 32-CPU quota, 6 h self-stop on every VM,
stop when idle, never mix x86 output into Mac-cached clips (separate complete x86 cache at
~/personal/gcp-farm; variants compared to x86 baseline, winner confirmed once on Mac).

**How to apply:** use the VM for recording the replay cache and the overnight line-level truth
job; nightly replay can run on a small resize (e2-standard-4). Never create VMs without the
6 h self-stop. See [[azure-bench-cache]], [[aws-stop-when-done]].

**Jashan's Mac is NOT used (user, Oct 13 2026):** session-to-session messaging between the two
Macs failed both ways; the user said to drop it. Helpers are: this Mac (cache recorder) and the
GCP VM (x86 A/B, real-time confirmations). Do not propose his Mac again.
