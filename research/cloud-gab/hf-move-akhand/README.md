# Akhand Kirtan gets its own GAB folder (Oct 16 2026)

Owner's request: Akhand Kirtan smagams (many singers, the sangat singing along) are a different level of data, so
they move from `1-kirtan-shabad/` to `5-akhand-kirtan/` in khalisfoundation/GurbaniAutopilotBench.

    node research/cloud-gab/hf-move-akhand/move.js            # dry run (any read token)
    node research/cloud-gab/hf-move-akhand/move.js --commit   # opens the PR (write token in HF_TOKEN)

The tools learn the folder in `gab-tools-cloud.patch` (folder-names TOP, gab-score / gab-publish titles, new sheet
rows of the Akhand tier go to the new folder) and the leaderboard page reads Akhand Kirtan from either key, so
results scored before the move still show. Checked before the PR: GAB-Akhand scored from a moved copy gives the same
78.2% (9.0.3) as before.
