# Original waterfall foam

`cascade-foam-v1.png` is original artwork generated with the built-in imagegen tool for Meadowlark Ranch. It was saved without pixel modification, with its generated transparency preserved. No Star Equestrian artwork is included.

The [generation prompt](generation-prompt.txt) describes fine natural foam and turbulent clear gaps. The runtime uses alpha multiplied by neutral RGB luminance as a moving density field, with two scrolling phases to avoid a reset seam. It is data in `NoColorSpace`, shared by both waterfalls and the Ribbon chute.

- Source SHA-256: `60bf1eefb9afe72a2f69d2c46fbaf6e305b27cc9fc0662b6e5f71f828546a38f`
- PNG: 1254 × 1254, RGBA8, 3,881,645 bytes
- Estimated RGBA8 GPU storage including mipmaps: 8,386,752 bytes
- One shared texture, two fragment lookups; no extra falling-water draw
- Missing or failed texture uses the original procedural flow shader.
