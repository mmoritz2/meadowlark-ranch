#!/usr/bin/env python3
"""Record the finite completed Fjord candidate QA without shipping raw art.

Usage: python3 tools/asset-gen/finalize-fjord-game-review.py --visual-reviewed
Run only after inspecting all current ordinary review PNGs. Root still owns
protected packaging, mounted tack/Studio QA, catalog activation and publication.
"""
from pathlib import Path
import argparse
import hashlib
import json

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/fjord-sculpt'
GAME=BASE/'game'
SHA='c652933791dc85ea7ec9a1c9b4707b04b4c4a1f1bb28c27a99b58a0f978c2178'


def digest(path):
    sha=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1048576),b''):sha.update(block)
    return sha.hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--visual-reviewed',action='store_true');args=parser.parse_args()
    assert args.visual_reviewed,'Actual current PNG review is required before setting candidate status'
    def read(name):return json.loads((GAME/name).read_text())
    profile=read('profile.json');build=read('build-report.json');motion=read('motion-validation.json');bake=read('animation-bake-report.json');ground=read('baked-ground-validation.json');hoofs=read('hoof-surface-validation.json');live=read('live-tail-validation.json');render=json.loads((GAME/'review/render-report.json').read_text())
    sha=digest(GAME/profile['file']);assert sha==profile['sha256']==bake['animatedSha256']==ground['animatedSha256']==hoofs['animatedSha256']==live['animatedSha256']==render['animatedSha256']
    assert all(motion['checks'].values()) and all(ground['checks'].values()) and all(hoofs['checks'].values()) and all(live['checks'].values())
    assert len(profile['clips'])==9 and bake['fps']==120 and digest(GAME/'fjord-rig.glb')==profile['rigSha256']==motion['rigSha256']
    wrapper=digest(ROOT/'assets/fjord-horse-motion.js');assert motion['candidateMotionModuleSha256']==live['candidateMotionModuleSha256']==wrapper
    assert digest(BASE/'source/Fjord_Final.stl')==SHA;receipt=json.loads((BASE/'source/receipt.json').read_text());assert receipt['sha256']==SHA and receipt['bytes']==648187484
    assert {('Rest','quarter'),('Rest','side'),('Walk','side'),('Gallop_Left','side'),('Jump','side')}=={(r['clip'],r['view']) for r in render['renders']}
    for r in render['renders']:assert digest(ROOT/r['image'])==r['imageSha256']
    adaptation='Actual TheBigWolfy Fjord sculpture reduced numerically and fitted uniformly to 1.42 m withers. New UV/dun/dorsal-stripe/hoof/muzzle/eye paint, two-tone paint on retained sculpted upright mane and long tail. Source LOD surfaces and vertex positions retained; anatomical forward stifle/back hock fitting and distance-based hair/leg ownership preserve continuous moving surfaces. New anatomical 40 skin/rig and nine 120 Hz gaits; candidate tail clearance preserves source-derived rest shape.'
    profile.update(available=True,sourceArtAdaptation=adaptation,visualReview='Actual source sampled orthographic shape and current Three-evaluated Rest quarter/side, Walk, Gallop_Left, Jump ordinary PNGs inspected. Final mounted tack and Studio checks belong integration.',motionStatus='Live anatomical gait/sole checks and independent lowerbody/allgroom checks pass; nine 120 Hz clips pass actual240Hz dense lowerbody/allgroom and independent whole-hoof playback checks.',gameReadyStatus='candidate QA complete; protected packaging and final mounted integration required before publication',generativeToolsUsed=False,
        candidateMotionModuleSha256=wrapper,motionKind='fjord',sourceAuthor='TheBigWolfy',tailClearance={'motion':'createFjordMotion','sourceRestShapePreserved':True,'actualTailOwnedSurfaceScan':True,'sharedCoreUnchanged':True,'validation':'live-tail-validation.json'})
    build.update(gameAnimatedSha256=sha,motionReview='passed independent live and actual stored playback reports',visualReview='current ordinary PNGs inspected; mounted tack/Studio integration pending',sourceArtAdaptation=adaptation,
        completedQaReports=['motion-validation.json','animation-bake-report.json','hoof-surface-validation.json','baked-ground-validation.json','live-tail-validation.json','review/render-report.json'],candidateMotionModuleSha256=wrapper)
    render['visualReview']='Actual current PNGs inspected: retained compact Fjord silhouette, upright source mane/long tail, new two-tone dun paint, distinct source leg poses and tail clearance visible. Conventional render of actual Three-deformed surfaces, no generated imagery.'
    for name,value in [('profile.json',profile),('build-report.json',build),('review/render-report.json',render)]: (GAME/name).write_text(json.dumps(value,indent=2)+'\n')
    report={'candidate':'fjord-sculpt','sourceSha256':SHA,'rigSha256':profile['rigSha256'],'animatedSha256':sha,'profileSha256':digest(GAME/'profile.json'),'candidateMotionModuleSha256':wrapper,'sharedMotionModuleSha256':motion['motionModuleSha256'],'withersM':1.42,'bodyHeightM':profile['heightM'],'overallHeightM':profile['overallHeightM'],'triangles':profile['triangles'],'joints':40,'clips':profile['clips'],'fps':120,'minStoredLowerBodyY':min(r['minLowerLegY'] for r in ground['rows']),'minStoredGroomY':min(r['minTailY'] for r in ground['rows']),'minIndependentHoofY':hoofs['minHoofY'],'allCandidateChecksPassed':True,'ordinaryRenderReviewed':True,'sourceOriginalAndReceiptHashMatches':True,'protectedPackagingRequired':True,'pendingIntegration':['protected delivery package','final mounted tack/rider and Studio checks','root catalog activation/publication']}
    (GAME/'candidate-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))


if __name__=='__main__':main()
