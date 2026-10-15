---
name: no-word-splitting
description: In code/data never split a Gurbani word into pieces (stored text, labels, string slicing); UI display truncation with "…" is fine
metadata:
  type: feedback
---

The user (Oct 14 2026): avoid splitting Bani in code; splitting on whole words or at a pangti is fine, but splitting a word may be disrespectful. Clarified: "on UI it's fine with ... as long as the word in the backend isn't truly being split."

**Why:** respect for Gurbani: the stored/processed text must keep every word whole.

**How to apply:** in backend code, datasets, answer keys and labels, keep Gurbani words intact (split only on spaces / pangti boundaries; never slice strings by character count or store word fragments). Visual truncation in the UI (CSS ellipsis) is acceptable. Internal normalising for matching (dropping vishraams/numerals, first letters for search) is not "splitting". See [[respectful-language]].
