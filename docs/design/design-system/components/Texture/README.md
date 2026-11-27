# Texture

The variation layer: 1-bit fills (dither, hatch, dots, stripes, graph paper) drawn in `ink` through a CSS mask, plus the line-style vocabulary.

Add `.tex` and one pattern class to any positioned box; the pattern paints behind its content in the current `ink`, so it follows Night shift automatically. Masks, not gradients — no new colours, no blends.

**Use:** category fills in bars and charts (ramp solid → dither → hatch → dots → paper), title-bar chrome (`stripe`), chart and empty-state grounds (`grid`, `dots`).
**Don't:** set body text directly on dither or hatch; stack two textures; use texture as a hover state (hover is inversion).
