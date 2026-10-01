#!/usr/bin/env python3
"""Stage the separately built two-lead Sporthorse Canter and its own foot masks."""

import hashlib
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "output/native-bay-sporthorse-canter"
SOURCE = ROOT / "review/native-breed-targets/bay-sporthorse/rest.glb"
SOURCE_SHA = "8f7f83e9669dc063dcb38455f8658369774ec0ce9b9eb81c2e7742e7d013d6a8"

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
report = json.loads((OUT / "build-report.json").read_text())
assert sha(SOURCE) == SOURCE_SHA == report["sourceSha256"]
assert sha(OUT / "model.glb") == report["candidateSha256"]
shutil.copyfile(OUT / "model.glb", HERE / "model.glb")
feet = {
    key: {
        "vertices": mask["wholeVertices"],
        "strictVertices": mask["vertices"],
        "toeVertices": mask["toeVertices"],
        "heelVertices": mask["heelVertices"],
        "centroid": mask["restCentroid"],
        "restMinY": mask["restMinY"],
        "restMaxY": mask["restMaxY"],
        "chain": mask["chain"],
        "terminal": mask["terminal"],
    }
    for key, mask in report["footMasks"].items()
}
record = {
    "sourceSha256": SOURCE_SHA,
    "fixedFloorY": report["floorY"],
    "bodyMarker1998HeightRatio": report["bodyHeightRatio"],
    "maskMethod": "Target Bay Sporthorse native rest hoof groups; fixed skinned floor, each sole below own min+7mm; no source-Walk masks reused.",
    "feet": feet,
}
(HERE / "foot-masks.json").write_text(json.dumps(record, indent=2) + "\n")
print(report["candidateSha256"])
