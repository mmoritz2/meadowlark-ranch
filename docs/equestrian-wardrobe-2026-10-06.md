# Equestrian wardrobe construction

The wardrobe now builds modern riding clothes as fitted, skinned garment layers. The visual direction follows the tailored jackets, collared shirts, layered vests, breeches and tall boots shown on [Star Equestrian's official site](https://starequestrian.com/). These are original procedural garment designs using Meadowlark's existing rider and boot assets.

- Competition jackets have an ivory shirt insert, folded lapels, pocket welts, metal buttons and a small horseshoe crest.
- Vests have separate shirt sleeves, a standing collar, zip and angled pockets. Denim and work jackets have raised patch pockets; polos have folded collars, plackets and cuffs.
- Breeches follow the rider's legs with knee/seat panels and seams. Belts and buckles fit the actual waist. Smooth boot shafts follow the calves and meet the existing shaped shoe/sole.
- Hidden shirt faces are removed beneath jackets and vests to prevent layer intersections in riding poses. Added pieces inherit interpolated skin weights, including the shared leg surfaces used by breeches and boots so they stay together when the knee bends.
- Identical cuts, breeches, belts and boots share cached geometry. Garment vertices are welded after fitting. The original body and skeleton are unchanged.
- All 48 outfit IDs, dye choices, collections, saved appearances and multiplayer fields are retained. The Stable hand recipe is now labelled Stable shirt.

Validation: `tools/qa-rider-tailoring.cjs` captures matching close-up, rear, full-body and seated views, verifies all cloth weights and sampled animated vertices. `tools/qa-rider-wardrobe.cjs` checks all outfits on both bodies and rapid switching. Accessory and character-editor suites verify attachment fitting, appearance persistence and phone layouts.
