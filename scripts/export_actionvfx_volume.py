"""Run with Blender's bundled Python to make a compact browser texture.

blender -b --python scripts/export_actionvfx_volume.py
"""

import json
from pathlib import Path

import numpy as np
import openvdb


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ActionVFX_Free_VDB_Shader_3D0114_LOD0" / "VDB Samples" / "Gas_Explosion_06_LOD0_0050.vdb"
DEST = ROOT / "public" / "vdb"
ORIGIN = (2, -1, 2)
FULL_SIZE = (252, 334, 260)
STEP = 2
SCALES = {"density": 12.0, "temperature": 15.0, "heat": 0.4}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    width, height, depth = (n // STEP for n in FULL_SIZE)
    # Three.js expects x to be the fastest moving texture coordinate.
    packed = np.zeros((depth, height, width, 4), dtype=np.uint8)
    packed[..., 3] = 255
    for channel, name in enumerate(SCALES):
        grid = openvdb.read(str(SOURCE), name)
        dense = np.zeros(FULL_SIZE, dtype=np.float32)
        grid.copyToArray(dense, ORIGIN)
        sampled = dense[::STEP, ::STEP, ::STEP]
        packed[..., channel] = np.transpose(
            np.clip(sampled / SCALES[name], 0, 1) * 255, (2, 1, 0)
        ).astype(np.uint8)
        print(name, "range", float(dense.min()), float(dense.max()), flush=True)

    (DEST / "actionvfx-gas.rgba").write_bytes(packed.tobytes())
    (DEST / "actionvfx-gas.json").write_text(json.dumps({
        "width": width, "height": height, "depth": depth,
        "scales": SCALES,
        "source": SOURCE.name,
        "frame": 50
    }, indent=2) + "\n", encoding="utf-8")
    print("exported", width, height, depth, packed.nbytes, "bytes", flush=True)


if __name__ == "__main__":
    main()
