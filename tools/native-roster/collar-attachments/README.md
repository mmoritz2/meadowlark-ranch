# Reviewed draft breastcollar attachment data

These sparse authoring snapshots contain 514 original collar vertex IDs plus their absolute raw position, normal, four joint indices and four weights. They preserve the standing appearance of the pinned morph prefix. `index.json` binds each snapshot to exact source/motion/morph hashes; `collar_attachment.py` appends them without requantizing the existing five mesh blocks.

The fit follows animated body triangle patches on stitched shoulder straps, tapers to the original saddle attachment and blends 70% fitted motion with 30% original motion. Rest-coincident seams share operators. Four influences are fitted using the actual inverse weighted rest transform, not by truncating a larger influence set. Normals follow Three's forward weighted skin transform.

See `review/draft-front-check/README.md` for runtime/visual evidence and remaining gallop contact/stretch limitations. Changing the pinned body or native motion requires a newly reviewed attachment; the build deliberately rejects mismatched inputs. The NPZs are the reviewed authoring inputs, not a runtime simulation.
