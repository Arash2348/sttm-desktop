---
name: voice-follow-firstletter-format
description: banidb FirstLetterStr is ASCII-font coded (not Unicode); convert before first-letter search
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-10T02:34:38.561Z
---

CORRECTION to an earlier wrong assumption: the sttm-desktop banidb `Verse.FirstLetterStr`
column is keyed on **ASCII-font** first-letter char codes, NOT Unicode codepoints. Verified
by `strings` on `~/Library/Application Support/SikhiToTheMax/sttmdesktop-evergreen-v2.realm`:
values look like `,065,112,107,109,109` (= A,p,k,m,m — zero-padded ASCII char codes 65/112/107/…),
and `BINDI_CHARS` in `www/main/banidb/constants.js` uses ASCII codes (103=g, 106=j, 115=s).

`banidb.query(q, FIRST_LETTERS_ANYWHERE, 'all', n)` internally does `charCodeAt` on each char of
`q` → so `q` must be the actual **ASCII-font first-letter characters** (e.g. "Apkmm"), which the
DB then matches via CONTAINS on the comma-codepoint string.

The recognizer / `anvaad.firstLetters(unicodeText)` emits UNICODE first-letters (e.g. "ਅਪਕਮਮ",
codes 2565+) → those NEVER match FirstLetterStr → "no match" forever. `anvaad.ascii(uni)` does
NOT help (returns comma-joined Unicode codepoints, wrong encoding). There is no direct
unicode→ascii-font converter in anvaad-js.

FIX (in [[voice-follow-desktop-integration]] blind auto-detect): build a Unicode-base→ASCII-font
map once via `anvaad.firstLetters(anvaad.unicode(ch))` for ch in ASCII 33..126, then map each
Unicode first-letter char to its ASCII-font char before querying. e.g. "ਐਸੀ ਪ੍ਰੀਤਿ ਕਰਹੁ ਮਨ ਮੇਰੇ"
→ firstLetters "ਅਪਕਮਮ" → ASCII "Apkmm" → matches `,065,112,107,109,109` (3 verses).

The app's own voice-search sidesteps this: the cloud service returns `transcriptInitials.ascii`
(already ASCII-font) which `SearchContent.jsx` feeds straight to search.
