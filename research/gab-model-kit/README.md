# GAB model kit

Score your Gurbani speech model on the **Gurbani Autopilot Bench (GAB)** recordings, next to the model the
STTM desktop app uses today (Karanbir int8); Surinder Singh's v3 kirtan CTC reference is coming. It runs on your own machine,
needs no app build and no keys from us. Audio and line-level truth come from the public Hugging Face dataset
[khalisfoundation/GurbaniAutopilotBench](https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench).

## 5-minute quickstart

```bash
git clone --depth 1 -b gab-tools-handoff https://github.com/Arash2348/sttm-desktop.git
cd sttm-desktop/research/gab-model-kit
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# once: accept the dataset terms (automatic approval) at
#   https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench
hf auth login          # a read token is enough

# (i) a CTC ONNX model (inputs audio [1,T] float32 + audio_len -> outputs log_probs, out_len)
python gabkit.py run --name my-model --onnx my-model.onnx --spm tokenizer.model --blank 0

# (ii) anything else: a Python file with transcribe(audio: np.float32 16 kHz mono) -> str
python gabkit.py run --name my-model --hook my_hook.py        # template: examples/hook_example.py
```

The default `--clips 2` is a quick check: 2 segments per tier (43 min of audio, ~2,900 model calls; ~3 min for
Karanbir's 100 MB int8 CTC on a laptop CPU). `--clips 0` runs the full sample (7 segments per tier, 2 h 22 min of
audio, about 3.5x longer). Results land in `results/<name>/results.md` and `results.json`; reruns resume
and `python gabkit.py score --name my-model` re-scores without the model.

Options: `--blank` (CTC blank id; default = last class), `--threads`, `--tiers kirtan,akhand`, `--max-pangti-s`
(default 20 s; the references use 20), `--data` (download cache, default `gab-data/`, ~10 MB per 5 min of audio).

## What it measures

Every model hears exactly the same audio:

1. **4 s windows** (1 s hop) over each segment: what the app's recogniser hears live.
2. **Whole pangtis** cut at their true line boundaries (1 to 20 s), each fed to the model on its own.

| metric | in plain words |
|---|---|
| **CER %** (whole pangtis) | letters wrong: edit distance between the model's text and the pangti's Gurbani text / letters in the pangti. Spaces, punctuation and numerals are ignored; Unicode NFC on both sides. Lower is better. |
| **found-CER %** | the same, but the pangti only has to be *found inside* the model's text: extra words around it (a repeated phrase, the start of the next pangti, alaap at the cut) are not counted. The fairest single number for sung audio. |
| **WER %** | words wrong (edit distance over words / words in the pangti). Harsh for Gurbani spelling variants; read it next to CER. |
| **hit@5 %** (4 s windows) | does the window's text find the right Shabad? The app's own search (character trigram index over the Gurbani corpus, ported exactly from the app) must put the true Shabad in its top 5. This is what matters to the sangat: a model that writes slightly wrong letters but still finds the Shabad is fine. |
| **30 s vote right % (wrong %)** | the Shabad named most often as top-1 over the last 30 s of windows (at least 3 votes, a clear leader). Right = a Shabad that was being sung/read in those 30 s; wrong = a different Shabad (worse than showing nothing). |

Windows with fewer than 8 letters are never searched (the app's own minimum) and count as misses.

## Tiers

| tier | audio | why |
|---|---|---|
| `paath_hall` | Renton Gurdwara Rehras Sahib / Kirtan Sohila (hall mic), live Jaap Sahib | spoken paath in a real hall |
| `paath_studio` | Sukhmani Sahib, Nitnem readers (studio) | clean spoken paath |
| `kirtan` | Renton kirtan, mixer feed (main GAB) | the everyday case |
| `hard` | GAB-Hard: Fremont hall, laptop mic | resonant hall, far mic |
| `akhand` | Akhand Kirtan: AKJ Toronto 2022, Manchester 2024 | many singers, sangat singing along |

Segment list: `sample.json`. Line truth is forced alignment audited by two models, or human-marked (GAB-Hard);
pangtis with alignment confidence < 0.6 are skipped.

## Reading the results

`results.md` puts your model on one row and the reference models directly under it, **on exactly the same
segments** (the per-segment reference counts are in `reference.json`, so a 2-clip run is compared with the
references' same 2 clips, not their full-sample average). Reference numbers on the full sample:

Karanbir int8 (the app model), full sample (`--clips 0`). Surinder v3 CTC reference: coming.

| tier | pangtis | CER % | found-CER % | WER % | hit@5 % | 30 s vote right % (wrong %) |
|---|---|---|---|---|---|---|
| Paath, hall mic (Renton Rehras / Sohila, live Jaap) | 315 | 25.4 | 23.7 | 60.7 | 86.4 | 92.3 (5.6) |
| Paath, studio (Sukhmani Sahib, Nitnem readers) | 364 | 15.1 | 14.3 | 46 | 95.8 | 96.8 (0) |
| Kirtan, mixer feed (Renton, main GAB) | 83 | 28.6 | 27.2 | 65.4 | 32.9 | 62.3 (18.5) |
| GAB-Hard (Fremont hall, laptop mic) | 52 | 92.4 | 75.3 | 113.2 | 4.3 | 8 (11) |
| Akhand Kirtan (AKJ Toronto 2022, Manchester 2024) | 130 | 37.7 | 34.1 | 74 | 23.5 | 51.9 (19.6) |

Rules of thumb: a few points of difference on `--clips 2` is noise (2 segments per tier); judge on `--clips 0`.
hit@5 and the vote decide what the sangat sees; CER explains why. A model that is better on `hard` / `akhand`
without being worse on `kirtan` and `paath_*` is what we are looking for.

## Notes

- `corpus.json.gz` is the Gurbani text snapshot the app searches (BaniDB, as shipped with STTM desktop):
  `[verseId, shabadId, text]`. The dataset's `lines.csv` verse ids point into it.
- The retrieval, the "same Gurbani in two places counts as right" rule and the vote are ports of the app's
  JavaScript, checked identical on 300 queries / 400 Shabad pairs.
- Models that fail on a pangti (e.g. an export with a fixed maximum length) score it as an empty transcript and
  print a warning.
- Some GAB-Hard recordings came from Gurdwara Sahib Fremont sessions; if your model was trained on those sessions,
  say so next to your numbers.
- Internal: `reference/make-reference.sh` rebuilds `reference.json`.
