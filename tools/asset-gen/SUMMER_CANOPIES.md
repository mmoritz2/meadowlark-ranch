# Summer broadleaf canopies

Detailed leaves and distant views share `assets/summer-leaf-pigment.mjs`. The transform restores green chroma while preserving each source texel’s linear luminance. It targets four explicit leaf material names; bark, fruit and conifers keep their source materials. Apply the pigment once before seasonal color and canopy occlusion. Distant views already contain it.

`assets/island-leaf-surfaces.mjs` grows the Island Tree scan’s 44,168 original quads uniformly around their centers, up to 1.25 times their original size. Boundary quads are capped to preserve the source XYZ bounds and all eight projected extrema. UVs, normals, winding, indices, source height and branch geometry remain unchanged. The helper validates the source buffers and runs once before canopy occlusion; both ordinary island trees and apple-tree derivatives use it. No triangles or draw calls are added.

Detailed broadleaf materials use a 0.22 coverage cutoff, including their shadow-depth materials. This keeps small leaf sprays from disappearing under texture minification. High-resolution source baking retains the authored 0.38 cutout; distant composite images keep their existing 0.22 cutoff. Opaque alpha-to-coverage and finite-normal protections remain enabled.

## Rebuild

The baker uses both shared helpers by default. Run from the repository root with the local preview server running. `QA_URL` and `PLAYWRIGHT_PATH` are optional overrides described in `tools/qa-platform.cjs`. Python with Pillow converts rendered atlases to lossless WebP.

To reproduce colors using the current checked-in geometry, framing and normals:

```sh
TREE_BAKE_OUTPUT_DIR=output/tree-colour-rebuild TREE_BAKE_ALBEDO_ONLY=1 node tools/asset-gen/bake-world-tree.cjs tree_small_02 tree_small_02_mature_leaves island_tree_01 orchard_apple jacaranda_tree upright_broadleaf_01
```

The color-only mode requires a separate output directory. It checks exact source geometry provenance, framing, alpha and normal bytes before writing its catalog. Changes to the island geometry helper require a full rebuild of both image channels:

```sh
TREE_BAKE_OUTPUT_DIR=output/tree-surface-rebuild node tools/asset-gen/bake-world-tree.cjs island_tree_01 orchard_apple
```

Both channels use the same source tree and camera frame. Natural horizontal padding includes the full crown; the original source height, bottom and vertical frame remain exact. Check every tile for cut edges, review detailed/card pairs in sunlight, rain, evening and low quality, and copy only accepted atlases plus their catalog metadata into the runtime asset directory.

The catalog retains the original CC0 source links and records helper hashes separately. Source GLBs remain unmodified. Existing tree selection, LOD budgets, roots, branch collision geometry and riding routes are unchanged. Tree density and close/distant shading still differ from the visual reference; this pass does not establish mobile frame-rate targets.
