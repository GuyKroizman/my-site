# Still — Yoga Session Builder

Open `/yoga`, or choose **Yoga Session Builder** on the home menu. The route is
lazy-loaded, and its CSS is scoped away from the game pages. No new dependencies,
accounts, API calls, or third-party pose assets are needed.

## Using the page

- Browse 18 essential poses. Search English/Sanskrit names, focus areas, or
  difficulty; combine focus chips with the difficulty filter.
- Open a pose for benefits, a simple cue, and a modification.
- Start with **Everyday reset**, or choose **New** for an empty routine.
- Add poses with `+` or drag them into insertion slots in the flow. Drag the grip
  to reorder; up/down buttons provide a keyboard and touch alternative.
- Set 1–60 breaths per pose. One breath is one inhale plus one exhale. Adjust each
  phase to 2–8 seconds in **Settle into your rhythm** (default: 4s in / 4s out).
- Sided poses have a Left/Right selector. Their duplicate button inserts the
  opposite side. Other poses duplicate with the same breath count.
- **Add a resting pose** inserts Child’s Pose; move it anywhere in the sequence.
  Other rest or counter-poses can be added from the catalog.
- Name the routine and assign a focus. The duration estimate uses the selected
  breath pace; extra transition time is not included.
- **Save session** keeps a named routine in **My sessions**, with practice, edit,
  duplicate, and delete actions. Limits: 100 poses per routine, 100 saved routines.
- **Practice** opens an uncluttered player. Press **Begin practice** when ready.
  Pause/resume, previous/next pose, chime mute, and optional browser full-screen
  controls are available. Space toggles playback when focus is not on a control.

## Persistence and privacy

`localStorage` keys:

- `still-yoga-draft-v1`: the current builder draft, persisted after every edit.
- `still-yoga-library-v1`: `{ version: 1, sessions: Routine[] }`.

Saved data is validated, including pose IDs, unique step IDs, timing ranges,
maximum sizes, and dates. A corrupt saved library is not overwritten; saving is
disabled and a warning is shown. Blocked/full storage also produces a warning,
while the in-memory builder/player remains usable. Storage does not sync across
devices, and clearing browser data removes it. There is no export/import or cloud
backup. Concurrent editing in multiple tabs is not supported.

## Player behavior

`playbackAt()` derives pose, inhale/exhale phase, breath count, and overall
progress from elapsed time. Animation frames never act as breath counters.
Pausing freezes the exact phase; resuming continues from there. Switching away
from the tab automatically pauses instead of silently skipping practice time.
The player requests a screen wake lock while running, where the browser allows
it. Full-screen and audio availability depend on browser permissions/support.

The pacer expands on inhale and contracts on exhale, without holds. Reduced-motion
preferences disable expansion while retaining text and numeric phase cues.
Web Audio synthesizes a quiet two-tone chime at pose transitions and completion;
there are no sound downloads. Audio is initialized from the Begin/Resume gesture.

## Files

- `poses.ts`: catalog metadata and pose cues.
- `model.ts`: routine types, validation, persistence, ordering, and timing math.
- `PoseCatalog.tsx`: discovery, filtering, and native-dialog pose details.
- `SessionBuilder.tsx`: metadata, sequence controls, and drag-and-drop slots.
- `SessionLibrary.tsx`: saved routine cards and actions.
- `GuidedPlayer.tsx`: playback, breath pacing, audio, and full-screen controls.
- `ui.tsx` / `yoga.css`: shared UI primitives and scoped styles.
- `../../pages/Yoga.tsx`: page orchestration, draft state, and navigation.
- `../../../public/yoga/poses/`: original local SVG illustrations.

## Adding a pose

Adding a pose has two parts:

1. **Catalog entry** — add a `Pose` object to the `poses` array in
   `src/features/yoga/poses.ts`. It needs an `id`, English `name`, `sanskrit`
   name, `focus` tags (pick from the `Focus` union), `difficulty`, `benefit`,
   `cue`, and `modification`. Set `sided: true` if the pose is practiced one
   side at a time so the builder offers a Left/Right selector.
2. **Illustration** — add a figure for the same `id` to `figures` in
   `scripts/generate-yoga-illustrations.mjs`, then regenerate the SVGs from the
   repository root:

```bash
node scripts/generate-yoga-illustrations.mjs
```

Each figure is a simple stick figure described by a head center, torso path,
arm path, and leg path. Copy a nearby pose (for example `mountain` for a
standing pose, `easy-seat` for a seated pose) and nudge the points into the new
shape. If you have not added a matching figure, the browser will still work but
the image will 404, so always add one before shipping.

The same flow works for AI additions: describe the desired pose to the agent
and ask it to edit `poses.ts` and the `figures` map together, then run the
script.

## Verification

```bash
npm run build
```

For browser checks, verify search/filter combinations, empty results, dialog
keyboard dismissal, drag-add/reorder, arrow reordering, opposite-side duplication,
reload persistence, library actions, and player pause/resume/completion. Check
both narrow and desktop screens, reduced motion, and blocked browser storage.

The illustrations are simplified reminders, not anatomical instruction. Poses
and benefits are general practice information, not medical advice. Users should
adapt shapes and breath pacing to their comfort and seek qualified instruction
when needed.
