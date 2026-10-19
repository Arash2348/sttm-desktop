"""Template for --hook: any framework works, the kit only calls transcribe().

    python gabkit.py run --name my-model --hook examples/hook_example.py

audio: np.float32 array, 16 kHz mono, range [-1, 1]. Called on 4 s windows and on whole pangtis (1-20 s).
Return Gurmukhi text (Unicode). Load the model once at import time, not per call.
"""
import numpy as np

# Example: a Hugging Face transformers CTC model (replace with your own loading code)
# from transformers import AutoProcessor, AutoModelForCTC
# import torch
# processor = AutoProcessor.from_pretrained("your-org/your-gurbani-model")
# model = AutoModelForCTC.from_pretrained("your-org/your-gurbani-model").eval()


def transcribe(audio: np.ndarray) -> str:
    # inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
    # with torch.inference_mode():
    #     ids = model(**inputs).logits.argmax(-1)[0]
    # return processor.decode(ids)
    raise NotImplementedError("put your model call here")
