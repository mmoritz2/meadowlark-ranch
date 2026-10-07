# Hollowpeak rock material

[Marble Cliff 02](https://polyhaven.com/a/marble_cliff_02) by **Amal Kumar**, published by Poly Haven under [CC0 1.0](https://polyhaven.com/license).

The diffuse and OpenGL normal maps are 1024px WebP; the packed AO/roughness/metalness map is 512px. The shader uses its roughness channel. Source scale: 6.8 metres. Runtime world-space projection and colour adjustment adapt this to the original mountain terrain. No Star Equestrian assets are included.

`manifest.json` records download URLs, verified source MD5, source and output SHA-256, authorship, licence and conversion sizes. Reproduce with:

```sh
python3 tools/asset-gen/fetch-village-materials.py --assets marble_cliff_02 --output assets/textures/falls
```
