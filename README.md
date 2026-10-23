# Shadower server switch

STTM's Shadower (the prod data collector) fetches `shadower/config.json` from this branch at
launch and then hourly:

https://raw.githubusercontent.com/Arash2348/sttm-desktop/shadower-config/shadower/config.json

GitHub's CDN caches the file for about 5 minutes, so a change reaches every install within
about an hour.

## Schema (every field optional)

```json
{ "enabled": true, "percent": 10, "allow": ["<installId>"], "block": ["<installId>"] }
```

- `enabled`: must be `true` for any install to collect. `false` or missing: everyone is idle.
- `percent`: 0-100. Installs whose stable bucket (FNV-1a hash of the install id, 0-99) is below
  this collect. Default 0.
- `allow`: install ids that collect whenever `enabled` is true, whatever `percent` says.
- `block`: install ids that never collect. Wins over everything else.

Order: `block`, then `enabled`, then `allow`, then `percent`.

If the file cannot be fetched or is not valid JSON, an install keeps its last good answer
for up to 7 days, then turns off. An install that has never had an answer stays off. Sharing
must also be allowed on the computer (the consent pill, or Settings).

The install id is in each uploaded `session.json` (`installId`). The code is
`www/main/addons/voice-follow/shadow/remote.js` on branch `vf-prod-collector-dev`.
