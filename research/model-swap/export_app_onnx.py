#!/usr/bin/env python3
"""export_app_onnx.py - turn an AI4Bharat IndicConformer-style hybrid .nemo (Surinder Singh's pa-v3/v4-kirtan) into
the app's ONNX contract, fp32 + int8:

    inputs  audio [1, T] float32 16 kHz mono, audio_len [1] int64
    outputs log_probs [1, F, 257] float32 (log-softmax over the pa slice + blank, blank = 256), out_len [1] int64

The same contract as Karanbir's karansea model, so the app (engine/infer.js) and GAB's replay harness run it unchanged.

- Front-end in the graph: NeMo AudioToMelSpectrogramPreprocessor from the checkpoint config, re-written with a conv
  STFT (torch.stft does not export): pre-emphasis 0.97, reflect pad n_fft/2, Hann(win, periodic=False) centred in
  n_fft, power spectrum, the module's own mel filterbank, log(x + 2^-24), per-feature normalisation (std n-1, +1e-5).
  Eval mode: no dither, pad_to as configured (0 for v3).
- "pa-only" head (the author's onnx-pa-only approach): the shared multilingual CTC head (22 x 256 + blank) is cut to
  the pa slice [k*256, (k+1)*256) + blank, and log-softmax runs over those 257 only (= the AI4Bharat multisoftmax
  language mask, which is how the model was trained and evaluated). Token order = the pa sentencepiece = tokens.txt.
- int8: onnxruntime dynamic quantisation of MatMul/Gemm weights only (per channel, QInt8). Convolutions and the
  front-end stay fp32 (quantising the conformer's convolutions is what broke the earlier int8 export).

Usage: python export_app_onnx.py <model.nemo> <out_dir> [--lang pa] [--check <wav> ...]
Writes out_dir/model.fp32.onnx, model.int8.onnx, tokens.txt, export.json (sha256, sizes, front-end, config).
Weights are read with torch.load(weights_only=True) (tensors only), streamed from the .nemo tar.
"""
import argparse, hashlib, io, json, os, sys, tarfile
import numpy as np
import torch


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def load_nemo(path, lang='pa'):
    from omegaconf import OmegaConf
    import sentencepiece as spm
    from nemo.collections.asr.modules import AudioToMelSpectrogramPreprocessor, ConformerEncoder, ConvASRDecoder
    tf = tarfile.open(path, 'r')
    names = {os.path.basename(m.name): m for m in tf.getmembers()}
    cfg = OmegaConf.to_container(OmegaConf.load(io.StringIO(tf.extractfile(names['model_config.yaml']).read().decode())))
    keys = cfg['joint'].get('language_keys') or cfg['aux_ctc']['decoder'].get('language_keys')
    k = keys.index(lang)
    voc_all = cfg['aux_ctc']['decoder']['vocabulary']
    per = len(voc_all) // len(keys)
    lo, hi, blank = k * per, (k + 1) * per, cfg['aux_ctc']['decoder']['num_classes']
    sp = spm.SentencePieceProcessor()
    spm_member = cfg['tokenizer']['langs'][lang]['model_path'].replace('nemo:', '')
    sp_bytes = tf.extractfile(names[spm_member]).read()
    sp.LoadFromSerializedProto(sp_bytes)
    assert sp.get_piece_size() == per, (sp.get_piece_size(), per)
    pieces = [sp.id_to_piece(i) for i in range(per)]
    assert voc_all[lo:hi][1:] == pieces[1:], 'pa slice of the CTC vocabulary != pa tokenizer'

    def clean(d, drop=('multisoftmax', 'multilingual', 'language_keys', 'vocabulary', '_target_')):
        return {a: b for a, b in d.items() if a not in drop}
    pp = clean(cfg['preprocessor'])
    pre = AudioToMelSpectrogramPreprocessor(**pp)
    enc = ConformerEncoder(**clean(cfg['encoder']))
    ctc = ConvASRDecoder(feat_in=cfg['aux_ctc']['decoder']['feat_in'], num_classes=cfg['aux_ctc']['decoder']['num_classes'])
    sd = torch.load(tf.extractfile(names['model_weights.ckpt']), map_location='cpu', weights_only=True)
    for pre_k, mod in {'preprocessor.': pre, 'encoder.': enc, 'ctc_decoder.': ctc}.items():
        sub = {kk[len(pre_k):]: v for kk, v in sd.items() if kk.startswith(pre_k)}
        missing, unexpected = mod.load_state_dict(sub, strict=False)
        missing = [m for m in missing if 'featurizer.window' not in m and 'featurizer.fb' not in m]
        assert not missing and not unexpected, (pre_k, missing[:5], unexpected[:5])
    for m in (pre, enc, ctc):
        m.eval()
    return dict(cfg=cfg, pp=pp, pre=pre, enc=enc, ctc=ctc, lo=lo, hi=hi, blank=blank, per=per, pieces=pieces,
                sp_bytes=sp_bytes, sp=sp)


class ConvMel(torch.nn.Module):
    """NeMo FilterbankFeatures (eval, center=True reflect, batch 1) with a conv STFT so it exports to ONNX."""

    def __init__(self, fbf):
        super().__init__()
        assert fbf.frame_splicing == 1 and fbf.log and fbf.log_zero_guard_type == 'add' and fbf.normalize == 'per_feature'
        assert not fbf.exact_pad, 'exact_pad front-ends are not handled'
        n_fft, win, hop = fbf.n_fft, fbf.win_length, fbf.hop_length
        w = fbf.window.detach().float()
        assert w.numel() == win
        left = (n_fft - win) // 2
        wpad = torch.zeros(n_fft)
        wpad[left:left + win] = w
        n = torch.arange(n_fft, dtype=torch.float64)
        f = torch.arange(n_fft // 2 + 1, dtype=torch.float64)
        ang = 2 * np.pi * f[:, None] * n[None, :] / n_fft
        real = (torch.cos(ang) * wpad.double()[None, :]).float()
        imag = (-torch.sin(ang) * wpad.double()[None, :]).float()
        self.register_buffer('basis', torch.cat([real, imag], 0)[:, None, :])  # [2*(n_fft/2+1), 1, n_fft]
        self.register_buffer('fb', fbf.fb.detach().float()[0])  # [n_mels, n_fft/2+1]
        self.nbin = n_fft // 2 + 1
        self.n_fft, self.hop = n_fft, hop
        self.preemph = fbf.preemph
        self.guard = float(fbf.log_zero_guard_value_fn(torch.zeros(1)))
        self.mag_power = fbf.mag_power
        self.pad_value = fbf.pad_value

    def forward(self, audio):  # audio [1, T]
        x = audio
        if self.preemph is not None:
            x = torch.cat((x[:, :1], x[:, 1:] - self.preemph * x[:, :-1]), dim=1)
        x = torch.nn.functional.pad(x[:, None, :], (self.n_fft // 2, self.n_fft // 2), mode='reflect')
        y = torch.nn.functional.conv1d(x, self.basis, stride=self.hop)  # [1, 2*nbin, F]
        re, im = y[:, :self.nbin], y[:, self.nbin:]
        p = re * re + im * im
        if self.mag_power != 2.0:
            p = torch.sqrt(p).pow(self.mag_power)
        m = torch.matmul(self.fb, p)  # [1, n_mels, F]
        m = torch.log(m + self.guard)
        nfr = m.shape[2]
        mean = m.mean(dim=2, keepdim=True)
        std = torch.sqrt(((m - mean) ** 2).sum(dim=2, keepdim=True) / (nfr - 1)) + 1e-5
        return (m - mean) / std


class AppModel(torch.nn.Module):
    def __init__(self, M):
        super().__init__()
        self.mel = ConvMel(M['pre'].featurizer)
        self.enc = M['enc']
        conv = M['ctc'].decoder_layers[0]
        sel = list(range(M['lo'], M['hi'])) + [M['blank']]
        head = torch.nn.Conv1d(conv.in_channels, len(sel), kernel_size=1, bias=True)
        with torch.no_grad():
            head.weight.copy_(conv.weight[sel])
            head.bias.copy_(conv.bias[sel])
        self.head = head

    def forward(self, audio, audio_len):
        f = self.mel(audio)
        flen = torch.div(audio_len, self.mel.hop, rounding_mode='floor') + 1
        e, el = self.enc(audio_signal=f, length=flen)
        lp = torch.log_softmax(self.head(e).transpose(1, 2), dim=-1)
        return lp, el


def reference(M, wav):
    """The NeMo modules themselves (preprocessor + encoder + CTC head, language-masked log-softmax)."""
    with torch.inference_mode():
        x = torch.from_numpy(wav)[None, :]
        f, fl = M['pre'](input_signal=x, length=torch.tensor([x.shape[1]]))
        e, el = M['enc'](audio_signal=f, length=fl)
        logits = M['ctc'].decoder_layers(e).transpose(1, 2)
        sel = list(range(M['lo'], M['hi'])) + [M['blank']]
        lp = torch.log_softmax(logits[:, :, sel], dim=-1)
        return lp[0, :int(el[0])].numpy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('nemo')
    ap.add_argument('out')
    ap.add_argument('--lang', default='pa')
    ap.add_argument('--threads', type=int, default=4)
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    os.makedirs(a.out, exist_ok=True)
    M = load_nemo(a.nemo, a.lang)
    model = AppModel(M).eval()
    # front-end check vs NeMo's own preprocessor (random + speech-like signal)
    rng = np.random.default_rng(0)
    sig = (rng.standard_normal(16000 * 3) * 0.05).astype(np.float32)
    with torch.inference_mode():
        f_ref, _ = M['pre'](input_signal=torch.from_numpy(sig)[None], length=torch.tensor([sig.size]))
        f_new = model.mel(torch.from_numpy(sig)[None])
    fe_diff = float((f_ref[:, :, :f_new.shape[2]] - f_new).abs().max())
    assert f_ref.shape[2] == f_new.shape[2], (f_ref.shape, f_new.shape)
    print(f'front-end vs NeMo preprocessor: max |diff| {fe_diff:.2e} over {f_new.shape[2]} frames')
    assert fe_diff < 1e-3, fe_diff
    fp32 = os.path.join(a.out, 'model.fp32.onnx')
    ex = torch.from_numpy((rng.standard_normal(16000 * 10) * 0.05).astype(np.float32))[None]
    with torch.inference_mode():
        torch.onnx.export(model, (ex, torch.tensor([ex.shape[1]], dtype=torch.long)), fp32,
                          input_names=['audio', 'audio_len'], output_names=['log_probs', 'out_len'],
                          dynamic_axes={'audio': {1: 'T'}, 'log_probs': {1: 'F'}}, opset_version=17, do_constant_folding=True)
    # external data guard: keep one file (the app downloads one file)
    import onnx
    m = onnx.load(fp32)
    if os.path.getsize(fp32) < 50e6:
        onnx.save_model(m, fp32, save_as_external_data=False)
    from onnxruntime.quantization import quantize_dynamic, QuantType
    int8 = os.path.join(a.out, 'model.int8.onnx')
    quantize_dynamic(fp32, int8, op_types_to_quantize=['MatMul', 'Gemm'], per_channel=True, weight_type=QuantType.QInt8)
    with open(os.path.join(a.out, 'tokens.txt'), 'w', encoding='utf-8') as fh:
        for i, p in enumerate(M['pieces']):
            fh.write(f'{p} {i}\n')
        fh.write(f'<blank> {M["per"]}\n')
    with open(os.path.join(a.out, 'tokenizer.model'), 'wb') as fh:
        fh.write(M['sp_bytes'])
    meta = {'source': os.path.basename(a.nemo), 'source_sha256': sha256(a.nemo), 'lang': a.lang,
            'slice': [M['lo'], M['hi']], 'blank_in_source': M['blank'], 'classes': M['per'] + 1,
            'front_end': {k: M['pp'].get(k) for k in ('sample_rate', 'features', 'n_fft', 'window_size', 'window_stride', 'window', 'normalize', 'dither', 'pad_to')},
            'front_end_max_diff_vs_nemo': fe_diff, 'quant': 'dynamic QInt8, MatMul+Gemm only, per channel',
            'files': {}}
    for f in ('model.fp32.onnx', 'model.int8.onnx', 'tokens.txt', 'tokenizer.model'):
        p = os.path.join(a.out, f)
        meta['files'][f] = {'bytes': os.path.getsize(p), 'sha256': sha256(p)}
    json.dump(meta, open(os.path.join(a.out, 'export.json'), 'w'), indent=1)
    print(json.dumps(meta['files'], indent=1))


if __name__ == '__main__':
    main()
