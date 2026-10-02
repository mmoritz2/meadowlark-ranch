# Final actual side-by-side check

The unrouted local public comparison passed for White Western, Bay Western and Bay Sporthorse at the exact b188/611b/feb8 final hashes. Both sides use the real clearance gate; before is the current12°/6° model and updated is the stronger30°/12° model with the frozen late Trot recovery phase change. All four gaits load correctly, all677 joints remain finite, stride phases match exactly, normal/half playback and before/updated/compare/close/whole controls work, and the labels identify both halves. Zero browser errors occurred.

`comparison-qa.json` pins13 unique requested source/model files, including the actual helper SHA `c96101951681c195e31cc07cdfc3bf525800e238f5760ef4499131caf7dcd8fa`. JavaScript/HTML/config hashes come from actual browser response bodies. Large GLB hashes use a full independent GET of the exact browser-requested URL with matching response ETag/Last-Modified identity because browser inspector caches do not retain those bodies. No asset or module was routed or substituted.

The paired peak screenshot makes the stronger backward toe tuck visible. The updated side keeps the knee/cannon trajectory at that middle-swing phase while the toe folds farther backward. This focused UI check does not establish complete animation naturalism or terrain/mounted contact. Separate kit transition and actual mounted reports cover those paths.

Run `NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-trot-reference-kit/qa-comparison.cjs` against a repository-root server. It loads the public `review/native-front-hoof-kit/review.html`, using its current final configuration, and writes evidence here.
