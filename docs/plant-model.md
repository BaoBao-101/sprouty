# Garden benefits and plant models

VIP changes storage allowance (10 memories per plant / unlimited for VIP), daily AI allowance
(5 for regular accounts / unlimited for VIP, shared across chat and plant coach), and optional scene/pot styles.
Care, sensors, device automation and action cooldowns do not depend on VIP.
The AI counter is reserved atomically in PostgreSQL and refunded on provider failure.
The day rolls over at midnight Vietnam time. Apply the `garden_benefits` migration
before deploying the backend. No new secret or API key is needed.

Expired membership keeps its saved decoration preference but the server returns
the default style. Existing memories remain readable even above the regular cap.
AI recaps and priority support are not advertised because they are not implemented.

## Botanical scope

Plant detail loads a Three.js viewer on demand. Drag to orbit, scroll/pinch to
zoom, or use arrow keys and +/- with the canvas focused; Home resets the view.
Carrot root inspection hides the pot and soil without changing plant state.
Forms follow stage, progress and health. Meshes are batched by material and
rendered only when the camera, size or plant changes. Cards keep the SVG art;
the detail viewer also falls back to it when WebGL is unavailable.
These are stylized educational models, not a photorealistic growth simulation.

Seven existing catalogue keys remain stable. Bean is specifically a climbing
common bean; herb uses basil as a representative, not all culinary herbs.
Tomatoes have compound foliage and support; peppers have simple narrow foliage;
beans have trifoliate leaves; carrots have divided foliage and a root cutaway;
corn has a tassel and lateral ear; sunflowers have a seed head; herbs are harvested
for leaves rather than fruit. Carrot and herb care reject pollination.

Moisture values are educational game units, not calibrated volumetric soil readings.
Growth pace and temperature bands are simplified design parameters. Stage progress
is kept for existing plants, and real-world harvest dates are not promised.

References used for biological distinctions (not regional planting calendars):
- https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-tomatoes
- https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-peppers
- https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-herbs
- https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/saving-vegetable-seeds
- https://www.extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables
