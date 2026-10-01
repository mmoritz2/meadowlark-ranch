#!/usr/bin/env python3
"""Copy the built Bay Walk and keep only compact, reviewable evidence here."""

import hashlib
import json
import shutil
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = ROOT / "output/native-bay-walk-continuous"
SOURCE_SHA = "6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


report = json.loads((OUTPUT / "build-report.json").read_text())
assert digest(ROOT / "review/native-bay-rollover/rest.glb") == SOURCE_SHA
assert report["sourceSha256"] == SOURCE_SHA
assert digest(OUTPUT / "model.glb") == report["candidateSha256"]
shutil.copyfile(OUTPUT / "model.glb", HERE / "model.glb")

# The full 128-frame IK solver trace stays in ignored output. The reviewer and
# browser QA need the actual anatomical foot masks and authored gait constants.
compact = {k: v for k, v in report.items() if k not in ("frames", "nativeCurveReference")}
save(HERE / "build-report.json", compact)

qa = json.loads((HERE / "qa-summary.json").read_text())
steps = json.loads((HERE / "step-audit.json").read_text())["Target Native Walk Rollover"]
preservation = json.loads((HERE / "preservation.json").read_text())
assert qa["candidateSha256"] == report["candidateSha256"]
assert preservation["candidateSha256"] == report["candidateSha256"]

contacts = qa["contacts"]
travel = qa["regionalTravel"]
regional_drifts = [v["ZWithNominalTravel"]["span"] for foot in travel.values() for v in foot.values()]
summary = {
    "candidateSha256": report["candidateSha256"],
    "sourceSha256": SOURCE_SHA,
    "clip": "Target Native Walk Rollover",
    "duration": report["duration"],
    "stanceFraction": report["stanceFraction"],
    "strideHalfM": report["strideHalfM"],
    "bodyHeightRatio": report["bodyHeightRatio"],
    "swingLiftM": report["foreSwingLiftM"],
    "nominalSpeedMps": report["impliedSpeedMps"],
    "uncopiedClosureMaxDegrees": report["uncopiedClosureMaxDegrees"],
    "maxActualLimbStepDegrees": steps[0]["maximumStepDegrees"],
    "maxActualLimbStepIntervalSeconds": report["duration"] / 128,
    "maxActualLimbStepJoint": steps[0]["name"],
    "authoredGridPass": report["authoredGridPass"],
    "worstOfflineVerticalTargetErrorM": report["worstVerticalErrorM"],
    "capHitsPer128Frames": report["capHits"],
    "browserQaPhases": qa["phases"],
    "browserFinite677AndNoErrors": qa["finite"] and not qa["errors"],
    "supportCounts": qa["supportCounts"],
    "wholeHoofStanceMinYRangeM": {
        "min": min(v["wholeHoofStanceMinY"]["min"] for v in contacts.values()),
        "max": max(v["wholeHoofStanceMinY"]["max"] for v in contacts.values()),
    },
    "maxRegionalForeAftDriftAtNominalTravelM": max(regional_drifts),
    "bodyMinYRangeM": qa["wholeBodyMinY"],
    "trunkMarker1998VerticalSpanM": qa["upperTrunk1998Y"]["span"],
    "headPivotVerticalSpanM": qa["headY"]["span"],
    "contactAndSupportPass": all(qa[k] for k in ("stancePass", "wholeBodyFloorPass", "regionalPlantPass", "noFlightInWalk")),
    "preservesOriginalNodesMeshesSkinBindsMaterialsMapsBinaryPrefix": all(preservation["preservation"].values()),
}
save(HERE / "build-summary.json", summary)
print(json.dumps(summary, indent=2))
