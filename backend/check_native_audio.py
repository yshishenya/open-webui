"""Check the native PyTorch libraries used by the production CPU image."""

import torch
import torchaudio
import torchvision


def main() -> None:
    """Fail if native versions or CPU audio/image operations are incompatible."""
    assert torch.__version__.split('+')[0] == '2.9.1'
    assert torchvision.__version__.split('+')[0] == '0.24.1'
    assert torchaudio.__version__.split('+')[0] == '2.9.1'
    waveform = torch.sin(torch.arange(16000, dtype=torch.float32) / 16000)
    resampled = torchaudio.functional.resample(waveform, 16000, 8000)
    assert resampled.shape == (8000,)
    assert torch.isfinite(resampled).all()
    boxes = torch.tensor([[0.0, 0.0, 1.0, 1.0], [0.0, 0.0, 1.0, 1.0]])
    assert torchvision.ops.nms(boxes, torch.tensor([0.9, 0.8]), 0.5).tolist() == [0]
    print('Native torch/torchvision/torchaudio imports and operations passed')


if __name__ == '__main__':
    main()
