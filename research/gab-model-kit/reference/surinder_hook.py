"""Reference hook (internal): Surinder Singh's IndicConformer pa v3 kirtan model, greedy CTC on the pa slice.
Reuses the verified NeMo adapter of the hearing harness (research/level2-dataset/tools/hearing-infer.py); needs a
venv with nemo_toolkit[asr]. Model file: ~/AAI/models/surinder-kirtan/indicconformer-pa-v3-kirtan.nemo (override with
SURINDER_NEMO)."""
import importlib.util, os
_here = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location('hearing_infer', os.path.join(_here, '../../level2-dataset/tools/hearing-infer.py'))
_m = importlib.util.module_from_spec(_s); _s.loader.exec_module(_m)
_eng = _m.NemoHybrid(os.environ.get('SURINDER_NEMO', os.path.expanduser('~/AAI/models/surinder-kirtan/indicconformer-pa-v3-kirtan.nemo')),
                     'ctc', threads=int(os.environ.get('HOOK_THREADS', 2)))


def transcribe(audio):
    return _eng.batch([audio])[0]
