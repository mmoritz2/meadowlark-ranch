# Bay Sporthorse lossless runtime package

This package retains the current native Bay Sporthorse appearance and four gait clips while removing unreachable historical data and sharing byte-identical buffer fields. The immutable [master kit](../native-bay-sporthorse-head-kit/README.md) stays available. The file falls from 33,940,296 to 16,961,188 bytes, a 50.03% reduction. Textures are not recompressed, numeric fields are not quantized, and the full 677-joint source rig remains.

[Independent field verification](field-preservation.json) compares 692 logical references covering all 368 used accessors and all five embedded PNG streams. Every original element byte, field descriptor, joint/bind, node, mesh, material and animation semantic matches after storage index remapping. This repacking does not preserve the original binary prefix.

[Actual GLTF and GPU comparison](qa-summary.json) covers 42 rest/gait/side/quarter cases, all 691 node transforms and all 60,688 skinned vertices per case. Differences are zero. Stable test-only mesh draw ordering also produces identical rendered pixels. Default draw ordering can produce tiny pixel differences even between two independent loads of the identical master; [control evidence](render-control.json) records that result. The game draw ordering remains unchanged.

Run `build.py`, then the independently implemented `check-fields.py`, to reproduce the exact candidate hash `a7ea093b602d1b6f3ce234afaed89925974faf7a127bf07b2900ac41674b0f74`. The profile uses this package; actual game integration and publication are recorded in release-verification.json when complete. This is a storage improvement and does not add breeds, faster gaits, Gallop or Jump.
