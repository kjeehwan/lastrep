# Lastrep Training Notebook Design Specification

Version: 1.32 | Date: October 21, 2026

Status: Workout, Home, Nutrition, Sleep, Profile and Settings browser design
directions approved through iterative review. Shared rules below incorporate that
feedback. Workout's native migration was approved and merged in PR #34. Home's
native migration was approved after phone review and merged in PR #35 on
October 17. Nutrition's native migration was approved and merged in PR #36.
Sleep's native migration is approved and merged in PR #37 after phone
review, including deletion, overlap handling and bidirectional target sync.
Account-write checks remain separate from read-only visual acceptance.
Profile's native migration is approved and merged in PR #38, including selective
photo writes, offline recovery and interrupted-upload retry. The optional one-call
photo optimization remains deferred locally and undeployed. Native Settings is
approved and merged in PR #39. Native Sign in / Sign up is merged in PR #40.
Four-step native onboarding is approved and merged in PR #41; its notes record
passed checks and coverage limits. Cross-screen release verification is in progress.
See workout-notebook-migration.md, home-notebook-migration.md and
nutrition-notebook-migration.md, sleep-notebook-migration.md and
settings-notebook-migration.md for boundaries and actual
verification coverage.
The initial Figma pair records an earlier Workout revision; the local browser
prototype and decisions below capture the subsequent approved refinements.

## 1. Purpose and scope

Create a distinctive, user-centered Lastrep interface rooted in the experience
of keeping a serious training log with a pen and a notepad. The records belong
to the user; recommendations are annotations that help the user act on them.

This document must be sufficient to produce consistent screen mockups without
consulting the original discussion. It specifies the visual system, layouts,
copy, interaction states, accessibility, responsive behavior and review criteria.

First implementation candidate: Workout. All six main screens now have approved
browser design baselines, including Profile and Settings (section 22).
No app screen code, fonts, dependencies,
branding assets or data models are changed by this document.

### Authority and interpretation

- Sections 3, 4, 11 and 12 are shared design rules for all future screens, not
  optional styling suggestions. Use their tokens and acceptance checks first.
- Screen-specific sections define intentional exceptions, such as the dense
  Workout table or Home's compact header. An exception must name its role and
  constraint; it must not become a new informal default elsewhere.
- Sections 17-19 identify mockup artifacts and their scope. Earlier Figma frames
  and historical revision descriptions do not override current shared rules.
- `Must` / `do not` identify requirements; `may` identifies an intentional choice.
  Example dates, user names, measurements and training prescriptions are fixtures,
  not fixed app copy or production-data requirements.
- Approved in a browser means the design is ready to guide implementation. It
  does not establish native font metrics, touch behavior or accessibility compliance.

### Product priorities, in order

1. Record and edit accurately, quickly and with one hand where practical.
2. Read current sets and previous performance at a glance.
3. Preserve trustworthy records, drafts, permissions and feedback.
4. Discover secondary features without overwhelming the active task.
5. Express an authentic training-log identity without decorative friction.

The design must work for beginners, experienced lifters, cardio users and people
who have never used a paper log. Nostalgia is an emotional reference, not a
prerequisite for understanding the app.

### What this is not

- Not a distressed journal, vintage scrapbook or bodybuilding stereotype.
- No spiral bindings, torn edges, fake handwriting, ink smears or paper textures.
- No ruled lines behind paragraphs, graphs or editable numbers.
- No page-turn effects, ornamental stamps or decorative graphs.
- No wholesale feature removal disguised as simplification.
- No assumption that purple or blue inherently indicates poor design. The change
  addresses hierarchy, consistency and task focus, not a superstition about color.

## 2. Design concept: a training ledger

Use a warm paper-like canvas, dark ink, deliberate typography, aligned numbers,
fine section rules and restrained editorial hierarchy. Entries should feel
specific to the person and date, rather than interchangeable dashboard cards.

The central metaphor is structural:

| Notebook idea | Digital expression | Avoid |
| --- | --- | --- |
| Dated page | Prominent session date and title | Fake page corners |
| Training entries | Exercise sections and set tables | A floating card around every row |
| Pen marks | Clear checkmarks, selected controls, a restrained accent | Scribbled fonts or animated drawing |
| Margin notes | Optional coaching and exercise notes | Advice competing with the set table |
| Looking back | Last column and exercise history | Unlabeled statistics with no actionable meaning |
| Correction | Editable values and contextual Undo | Destructive cross-outs replacing readable records |

### Visual hierarchy

1. The task: session title, exercise names, editable set values.
2. Supporting facts: previous performance, units, timer, completed count.
3. Optional help: guidance, explanations, exercise demonstration and metadata.
4. Administration: routine management, preferences and destructive actions.

Never use a more saturated surface or larger type for level 3 than level 1.

## 3. Measurement conventions and tokens

All layout values are logical dp; font sizes are sp. Figma uses equivalent logical
pixels at 1x. Do not copy physical device screenshot pixels into app styles.
All screen coordinates below begin inside the safe area unless stated otherwise.

### Spacing and shape

| Token | Value | Use |
| --- | --- | --- |
| space-1 | 4 | Icon-to-label micro-spacing |
| space-2 | 8 | Related text and controls |
| space-3 | 12 | Field gaps, small section padding |
| space-4 | 16 | Standard section gap and compact screen inset |
| space-5 | 20 | Main phone screen inset |
| space-6 | 24 | Major section spacing |
| space-8 | 32 | Separate unrelated groups |
| gap-icon-label | 6 | Icon-to-label gap in compact supporting actions |
| radius-input | 6 | Numeric/text inputs and small controls |
| radius-button | 8 | Primary and secondary buttons |
| radius-panel | 8 | Quiet grouped surface panels, including Home |
| radius-dialog | 12 | Centered acknowledgement/confirmation dialogs |
| radius-sheet | 16 | Top sheet corners |
| rule | 1 | Section separators and control borders |
| focus-ring | 2 | Visible focused input/control border |

Do not use fully rounded pills for every control. Use small rectangles with soft
corners for the ledger character. Only compact status badges may use pill shapes.

### Color roles

Use semantic tokens, never isolated screen-specific approximations. These exact
values define the mockup baseline. Contrast must be measured during implementation
for actual foreground/background pairs, including disabled and selected states.

| Role | Paper theme | Dark theme | Purpose |
| --- | --- | --- | --- |
| canvas | #F6F2E9 | #191A18 | Main page |
| surface | #FFFCF5 | #242521 | Inputs, dialogs, selected group surfaces |
| surface-subtle | #ECE7DC | #2D2E29 | Quiet selected rows and secondary grouping |
| ink | #242720 | #F3F0E6 | Primary text and default icons |
| ink-secondary | #625F55 | #BBB7AC | Supporting text and placeholders |
| rule-subtle | #D8D1C3 | #41433A | Non-interactive separators |
| control-border | #817B6E | #8E9083 | Necessary field/control boundaries |
| accent | #A33F24 | #F2A07D | Links, selected indicators, focused controls |
| accent-soft | #F3E4D8 | #3B2D25 | Small annotation/status backgrounds |
| on-primary | #FFFCF5 | #191A18 | Text on solid primary button |
| primary-fill | #242720 | #F3F0E6 | Primary button and active completion checkbox |
| success | #3E6248 | #A6C6A6 | Saved/completed confirmation |
| danger | #A12E2B | #FFAAA2 | Destructive actions and errors |
| warning | #795000 | #E8C376 | Actual caution, never generic decoration |
| backdrop | #000000 at 40% | #000000 at 60% | Modal scrim |

- Paper theme is the primary exploration, not an approved forced default. Mock up
  and review dark mode before changing existing theme behavior.
- Primary actions are ink-filled, not orange-filled. Accent is a small emphasis.
- Body text remains ink; do not render whole advice panels in warning colors.
- No gradient page backgrounds, glass blur or large colored glow shadows.
- Charts and macros may use additional semantic colors; see section 13.
- Do not communicate status by color alone. Pair with words, shape or an icon.

### Typography

Approved browser pairing: Source Serif 4 for editorial titles, Source Sans 3 for interface
text and data. Verify font files, license notices, supported glyphs, tabular figures
and native Android font mapping before implementation. Files and licenses are
bundled with the local prototype, not installed in the native app by this document.
Never depend on a live font network request.

| Style | Family / weight | Size / line height | Use |
| --- | --- | --- | --- |
| page-title | Source Serif 4 / 600 | 26 / 32 | Session or main page title |
| section-title | Source Sans 3 / 600 | 20 / 26 | Exercise heading, card heading |
| dialog-title | Source Serif 4 / 600 | 24 / 30 | Sheet/dialog heading |
| body | Source Sans 3 / 400 | 16 / 22 | Body and input text |
| body-strong | Source Sans 3 / 600 | 16 / 22 | Actions and row titles |
| numeric-input | Source Sans 3 / 600 | 17 / 24 | Set values; tabular numerals |
| supporting | Source Sans 3 / 400 | 14 / 20 | Last values, metadata and hints |
| label | Source Sans 3 / 600 | 13 / 18 | Table headers, badges |
| timer | Source Sans 3 / 600 | 20 / 26 | Running timer; tabular numerals |

- Do not use serif for numeric inputs, dense tables or long explanations.
- Use sentence case. No letter-spaced all-caps slogans or oversized decision labels.
- Default readable table text must not drop below 13 sp to fit columns.
- Native script fallback must support Korean and other user-entered names. Do not
  force Latin-only fonts on names or notes. Validate mixed-script line metrics.
- Font loading failure uses readable platform fallback; it must not block logging.
- Dynamic type wraps and reflows; it must not silently disable font scaling.

### Icon and completion tokens

Sizes below describe the visual glyph, not its button or surrounding layout slot.
Use these roles consistently on Home, Workout and future screen mockups. A 24-wide
alignment slot does not mean that every glyph inside it is 24 wide.

| Token / role | Default visual size | At 200% text | Target / placement |
| --- | --- | --- | --- |
| icon-header | 22 x 22 | 22 x 22 | Compact header: 44 x 44; general toolbar: 48 x 48 |
| icon-tab | 22 x 22 | 22 x 22 | Equal destination regions; preserve bottom safe inset |
| icon-supporting | 16 x 16 | 24 x 24 | Demo, Rest, Tempo; min 44-high labeled action |
| icon-annotation | 20 x 20 | 24 x 24, or omit decorative icon when reflowing | Guidance/context row, never instead of its label |
| icon-row | 20 x 20 | 24 x 24 | 24-wide alignment slot + 12 gap at default size |
| icon-close | 28 x 28 visual bounds | 36 x 36 visual bounds | 48 x 48; 56 x 56 at 200% |
| help-glyph | 16 x 16 information-circle-outline | 16 x 16 | Centered 44 x 44; retain space when labels reflow |
| completion-box | 20 x 20; check 16 x 16 | 36 x 36; check 28 x 28 | Dense row: 44 x 48; enlarged row: min 64 high |
| chart-observation | Radius 4 | Radius 8 | Minimum 44-diameter selection region; show date/value outside plot |

- Default outline stroke is 1.5, with rounded caps/joins where appropriate.
  Use the same outline family and optical weight, not unrelated icons that happen
  to fit the same square. Never use emoji as interface icons.
- A glyph's drawn bounds and negative space must be checked at rendered size.
  Matching SVG dimensions alone does not ensure matching apparent size. Prefer
  a simpler glyph before enlarging it outside its role token.
- Keep the title or accessible name independent from the drawing. Calendar and
  Settings retain those names even when Settings uses adjustment sliders.
- Center the visual glyph in its target. Do not offset the tap region to one side
  to make adjacent text appear closer; change the layout instead. Focus outlines
  must reveal the real target. Adjacent targets and hit slop must not overlap.
- Icons do not all double with text. Fixed header/tab glyphs retain their sizes;
  enlarged labeled actions, help and completion controls use the explicit tokens.
  Keep the tab labels readable and test screen-reader names separately.
- Dense ledger controls use unboxed outline glyphs in full, nonoverlapping tap
  targets. Do not enlarge each record merely to add secondary controls; reveal
  controls in a deliberate editing mode. Reflow remains allowed for large text.
- Avoid duplicate actions: tapping a record can open its editor without an extra
  plus/edit icon doing the same thing. A menu must provide distinct useful actions;
  a non-gesture Delete alternative remains justified alongside swipe deletion.

### Approved icon vocabulary

| Meaning | Drawing / rule | Where it applies |
| --- | --- | --- |
| Calendar | Simple rectangular calendar, binding marks and restrained ruled details | Home and future date-entry controls |
| Settings | Three adjustment sliders; do not retain the earlier small irregular gear | Home header and equivalent Settings entries |
| Workout | Single-stroke loaded barbell; larger plates nearest the grip, smaller outside | Same drawing on every bottom tab bar |
| Tempo | Existing outline speedometer plus the word Tempo | Resistance/bodyweight exercise controls, not cardio |
| Help | Shared circled information outline, muted ink, via NotebookInfoButton | Inline definitions and Home Readiness/Weekly Trends explanations, not decorative badges |
| Completion | Square checkbox; do not replace cardio completion with a different large button | Set and cardio completion |

The approved small barbell is a documented optical exception: shaft stroke 1.5,
plate strokes 2.1. Use single edges rather than several closely packed rectangular
outlines. Do not thicken every other navigation icon to compensate. The mockup's
SVG definitions live in `prototypes/training-notebook/home.mjs` and `prototype.mjs`;
native implementation must reuse a matching approved drawing or shared component.

## 4. Shared layout and component grammar

### App shell

- Sticky page toolbar: minimum 56 high, 20 horizontal inset, title and icon hit
  targets aligned vertically. It stays outside the page ScrollView.
- Workout uses an 80-high toolbar with 16 top/bottom padding around its 48-high
  Finish button. This creates breathing room after the system status area and
  between Finish and the bottom separator. Do not add padding inside the actual
  Android status bar or replace real safe-area insets with fixture dimensions.
- Preserve safe areas and system-bar insets; never paint content behind Android
  navigation controls or use fixed assumptions about status-bar height.
- Bottom navigation: five existing destinations and labels in their current order:
  Home, Workout, Nutrition, Sleep, Profile. Minimum 56 high plus bottom inset.
- Tab icon: `icon-tab` (22), label: 12/16. Selected tab uses ink and a visibly
  heavier stroke (2.5 versus 1.5); retain the same glyph geometry and touch target.
  No large circular selection background or floating tab capsule.
- Header and tab surfaces use canvas with a single separator, not glass or shadow.
- On root pages, page title is left-aligned. A nested page may have Back; its title
  and right action must fit without shifting when an action is unavailable.
- Keep existing navigation behavior, including Settings back returning to a valid
  app screen. A visual redesign is not permission to change routing semantics.
- Compact icon groups use equal targets, an 8 gap and vertical center alignment.
  Home Calendar, Settings and profile use 44-wide targets; profile initials/photos
  do not receive a different invisible width. Use header icon tokens, not per-button
  scaling until the glyph looks acceptable by eye.

### Sections, panels and cards

Default page sections are separated by 24 vertical space and a fine rule where
needed. Do not wrap the whole page in a card inside another card.

Use a surface panel only for a genuinely grouped action, an editable form, a modal,
or a comparison that benefits from a distinct boundary. If a panel has a heading,
the heading lives inside it with 16 padding, matching other panels.

For each panel/row, reserve a consistent 24-wide icon slot plus 12 gap before text.
Items without icons omit the slot intentionally; unrelated icon glyph widths must
not determine text alignment.

### Divider ownership

- Dividers separate adjacent items or sections; they are not decorative underlines.
- In a list, draw row separators only between visible items. A single-item list
  has no row separator, and the last visible item has no trailing separator.
- Apply this after filtering, collapsing or excluding items, not using the raw
  data count. Expanded and empty states must not leave orphan rules.
- Let the next section's top rule, the surrounding panel border or the toolbar
  divider own that boundary. Do not add another line from the preceding content
  or first section to represent the same boundary.
- Keep the normal section spacing when removing a duplicate line; do not replace
  it with an extra border or tighten the layout to compensate.
- Apply across sleep entries, meal/food rows, workout history and comparable
  grouped lists. Preserve functional table borders and chart target/grid lines;
  those communicate different information, not section boundaries.

### Buttons and inputs

- Primary button: min-height 48, horizontal padding 16, ink fill, on-primary label.
- Secondary: same height, transparent/surface fill, control-border, ink label.
- Text action: min-height 44, accent text; always a meaningful verb.
- Icon button: use the role's visual size and target from section 3. Default
  standalone target is 48 x 48; named compact-header/help exceptions are 44 x 44.
- Pressed state: immediate surface change, no scale bounce. Disabled: unavailable
  action plus distinct muted styling, not merely an unexplained faded button.
- Profile shows no save action or saved status when opened with a clean draft.
  Show `Save` for an actionable draft and `Saving...` during a write. After success,
  hide Save and briefly show `✓ Changes saved` inline for four seconds, clearing
  it on new edits or leaving the screen. Failed saves retain the draft and Save.
  Keep upload/save progress and the brief confirmation visible outside
  page scrolling, including when Save and leave awaits completion.
- Fields: surface fill, visible control-border, 6 radius, min-height 48, 12 inset.
  Focus uses a 2-dp accent border without changing outer geometry.
- Labels are persistent; placeholders are examples, never the only field name.
- Long names wrap; do not shrink every label to fit. Units use their own space.
- Numeric fields retain existing decimal rules and intermediate input such as
  `20.`; do not rewrite text or move focus during each keystroke.
- No unlabeled checkbox, trash icon, chevron or calendar icon for accessibility.

### Alignment and visible spacing

- Distinguish three measurements: drawn glyph bounds, content bounds (icon plus
  text) and tap-target bounds. Inspect all three rather than declaring alignment
  correct because the outer rectangles have equal widths.
- Use equal-width targets for compact icon-only groups. Use content-sized
  targets and equal visible gaps for a row of unequal-length labeled actions,
  such as Demo / Rest 02:00 / Tempo 3-0-1-0. Minimum gap 12; do not squeeze
  the Tempo label or remove its icon to force equal-width button boxes.
- Related binary unit/effort choices use equal-width cells within each group.
  This does not change the content-sized Workout Demo / Rest / Tempo toolbar.
- Related text and action rows share first-line alignment, even if the text wraps.
  Do not vertically center Change against a multiline routine name or Review
  against a multiline guidance label. Match line height and top padding.
- Repeated trailing actions share a visible right edge, not merely similarly
  positioned targets. Repeated input and unit columns share the same x positions.
- A button must have breathing room above and below it. Get started uses 20
  above its action group; Workout's header uses 16 around Finish. Treat these as
  named examples of group separation, not a requirement for 20 above every button.
- Success icons and their headings sit on one horizontal row with a 12 gap.
  Center them vertically; allow the title to wrap without stranding the icon
  above a separate paragraph. Detailed confirmation copy stays below.
- Panel headings belong inside their grouping, use `section-title` (20/26),
  and must not be smaller just because a panel is conditional or first-user-only.

### Shared form pattern

- Field titles, input values, placeholders and adjacent units use Source Sans 3.
  At default size, body-data titles/inputs use 16; units use supporting 14. Set
  inputs use the separately specified numeric-input style, not these body-data widths.
- The label is persistent. A new measurement uses `e.g.` plus the latest known
  value for that metric, or an example if none exists. Editing shows actual
  recorded values, not an example, 1, or an unexplained zero.
- Left-align typed values and placeholders. An empty field starts with its cursor
  at the left. On first focus, select an existing numeric value for replacement
  with the active selection end at the right; do not reselect on each keystroke,
  render or subsequent caret-placement tap. On native Android, schedule initial
  focus after the modal's shown event and disable repeated select-all once the
  first focus is handled; do not leave a repeat-select flag active while typing.
  Keep units
  outside the input with a small fixed gap; units must never overlap editable text.
- Preserve the parent screen's scroll position when opening or closing editors,
  including Save, Done, Cancel and help sheets. Keep the focused field above the
  keyboard and re-check visibility after rotation or keyboard-size changes.
  Browser viewport checks do not replace native phone/IME testing.
- Profile reveals only the obscured portion of the focused input; do not force
  every input to the top. Focus scrolling may animate when reduced motion is off.
- Definitions use the shared help glyph immediately after the relevant title,
  vertically centered. Its correctly centered target occupies real layout space;
  leave the input/unit columns aligned rather than moving them for each title.
- Forms must distinguish Add today from editing an existing record by naming
  the actual dates. Use `Edit Oct 12`, not an ambiguous Edit selected. An older
  record remains editable; no record for that date means no edit action.
- Selecting a chart point only selects a record. Add/edit is an explicit separate
  action; opening it defaults to Add today. Keep independent add/edit drafts
  when switching modes, and identify the affected date in Save/Delete feedback.
- Close, outside dismissal and Cancel must not silently save unfinished edits.
  Use explicit loss confirmation when existing product behavior requires it.
- Tapping outside a popup dismisses through its existing close/cancel handler.
  Full-screen layout wrappers must not consume the backdrop's empty-space taps;
  taps inside the card and its controls must not dismiss it. Pending writes keep
  their existing non-cancellation/data-integrity guards.

### Shared data-visualization pattern

- Begin with the user's question. Use a chart to show distribution or change,
  not to decorate a number or make sparse data look comprehensive.
- Workouts comparison uses named, dated sessions and counts in two columns.
  Training distribution may use a volume-weighted contribution grid with date,
  session name and volume on selection. Higher volume is not inherently better.
- Daily calorie/sleep comparisons can use readable averages plus dated values.
  Do not require a line/bar chart when those values already answer the question.
- Label incomplete periods explicitly. `This week · In progress` versus
  `Last week · Full week` must not imply equal observation windows. State the
  denominator: recorded sessions, logged days or recorded nights.
- Missing observations are not zeros. A metric selects its own latest actual
  observation; today's weight must not set the date for body fat last measured
  in July. Keep lean body mass and skeletal muscle mass distinct.
- On first opening, place the latest observation in view and select it. Selecting
  an older point keeps it selected through unrelated updates. Recenter on size
  changes where needed, without taking away deliberate browsing of older records.
- At 200%, enlarge marks and date labels with the plot and provide horizontal
  room. Do not keep tiny labels, overlap them, clip away the latest point, or
  downscale the entire plot to defeat text accessibility.
- Format dates from valid normalized date values. Test single-digit days and
  month/year boundaries; zero-pad ISO date components. `Invalid Date` must never
  be accepted as a fixture limitation or user-facing label.

### Elevation and motion

Only modal surfaces need elevation: 0 4 16 rgba(0,0,0,0.12) for mockups. No shadow
on every exercise. Use platform-appropriate rendering, not expensive blurred layers.
Press feedback is immediate; sheet transition 180-220 ms; section expand 120-160 ms.
Respect reduced motion. Never delay input, saving or navigation for animation.

## 5. Workout information architecture

### Important distinction

The following relocation is a proposed UX change, not a statement about today's
implementation. The current screen places session, guidance, routines and
recommendation controls above exercise entries. The redesign keeps all of those
capabilities but gives an active workout precedence over setup controls.

### Empty session

Order: sticky toolbar; date/session heading; concise empty prompt; setup actions;
bottom navigation. Do not show an empty set table, false performance data, a
disabled Finish button or an automatically generated AI plan.

Copy and actions:

- Heading: `Your next session`
- Body: `Choose a routine or add your first exercise.`
- Primary: `Choose routine`
- Secondary: `Add exercise`
- Text actions: `Recommend workout`, `Repeat past workout`, `Create routine`

Recommendation focus and Quick/Standard/Extended are in the Recommend workout
sheet, not a permanently expanded bank of chips. Preserve all supported focuses
and existing volume/recovery logic; do not promise a fixed set count that differs
from the actual recommendation. Routine management remains available in Choose.

### Planned or active session

Order:

1. Sticky toolbar: `Workout` at left; labeled `Finish` action at right.
2. Session heading: date, title, phase and elapsed timer.
3. One-line workout-source action and optional compact guidance annotation.
4. Exercise entries in their actual order.
5. `+ Add exercise` and secondary session actions at end of the list.
6. Conditional rest-timer dock above persistent bottom tabs.

`Finish` is the primary toolbar action, ink-filled, minimum 72 x 44. It opens the
existing finish review; it never immediately saves. Do not add a second sticky
Finish CTA that competes with it. When routine builder is active, replace this
with `Save routine` and clearly show `Routine builder`; do not show workout timers
or falsely count routine editing as a completed workout.

Move Discard into a labeled session overflow menu. It remains easy to find but
does not sit beside the most frequently tapped input. This is a proposed
placement change; preserve destructive confirmation and existing draft semantics.

### Reference portrait wireframe

Frame: 390 x 844, paper theme. Reference safe top 24 and bottom 24 are mockup
fixtures only; actual system insets are dynamic. Usable content width = 350.

```text
Workout                                      [Finish]
----------------------------------------------------
Thu, Oct 15                                    18:42
Chest + Triceps
Hypertrophy
Routine: Chest + Triceps                     [Change]

[note icon] Today's Plan                    [Review >]
----------------------------------------------------
01  Bench press                                  [...]
    [Demo]  [Rest 02:00]  [Tempo 3-0-1-0]
    Note [Keep the last rep controlled                   ]

Set       Last             kg       Reps     RPE   Done
1         105 x 3 @ 10     [100]     [5]      [ ]   [x]
2         105 x 3 @ 10     [100]     [5]      [ ]   [ ]
3         105 x 3 @ 10     [100]     [5]      [ ]   [ ]
[+ Add set]                         [Duplicate last set]
----------------------------------------------------
02  Incline dumbbell press                       [...]
...
----------------------------------------------------
[+ Add exercise]
[Save as routine]                    [Session options]
----------------------------------------------------
Rest: Bench press           01:24       [Pause] [Skip]
----------------------------------------------------
Home       Workout       Nutrition       Sleep    Profile
```

Wireframe communicates order, not literal monospace font, checkbox glyphs or exact
line lengths. Use the numeric layout below for dimensions. No invented health
claims or changed recommendations should be inferred from fixture prescriptions.

### Session heading dimensions

- Begins 16 below toolbar; date in supporting style, timer right-aligned.
- Session title 8 below date, page-title style, wraps to two lines before growing.
- Phase appears 8 below title; metadata is not an orange badge wall. Omit the
  redundant `Timer running` text. If a paused state needs a label, place `Paused`
  adjacent to the elapsed time, not in a separate row far from the number.
- Source row 12 below metadata, minimum 44 high. `Change` opens routine/setup
  actions. Loading another workout preserves the existing replace/append guard.
- Right-align the visible `Change` and `Review` labels to the content's right
  edge. Give both actions the same 62-wide, 44-high target; do not center the
  labels in differently sized targets. The guidance row uses 20 for its icon,
  two 8-dp gaps, 252 for its title and 62 for Review, totaling 350.
- Guidance row 8 below source; next exercise separator 16 below guidance.
- If no guidance applies, show `Today's Plan` / `Review` without a speculative
  decision. Do not reserve a blank panel after it disappears.
- Per-second timer text must not cause title/row width changes or whole-page renders.

## 6. Exercise entry and set-table specification

### Entry shell

- No colored floating card. Canvas background, 1-dp top rule, 16 top/bottom space.
- Heading: 24-wide ordinal slot, 8 gap, flexible exercise name, 48 overflow target.
- Name uses section-title style, max two lines before expanding naturally for
  accessibility. Tapping the name opens the existing history/progress modal.
- Supporting controls row has min-height 44: `Demo`, `Rest 02:00`, `Tempo`.
  When saved, show the tempo value, e.g. `Tempo 3-0-1-0`; allow a second line
  within its target rather than shrinking the text. Never invent an unset tempo.
- Keep the existing `speedometer-outline` icon alongside Tempo in the native
  app; the browser prototype uses a matching outline speedometer treatment.
- Use content-sized controls with equal visible gaps distributed across the
  row, at least 44-high and 44-wide targets and a minimum 12 gap. The Tempo
  value makes that control wider; equal-width targets alone do not create equal
  visible spacing. At enlarged text, stack controls as full-width rows.
- Within Demo/Rest/Tempo, use the shared 6 icon-to-label gap (8 at 200%) rather
  than adjusting each control independently to compensate for its label length.
- Keep Demo, Rest and Tempo controls for custom resistance exercises too. Tapping Demo
  opens a neutral unavailable-media placeholder when no demo exists. Do not put
  that placeholder permanently above the set table.
- Remove the Details expansion. Keep a visible editable field labeled `Note`
  below the supporting controls, showing the saved note or an example placeholder.
  Available weights stays in the three-dot exercise menu.
- Cardio retains Demo, Rest and Note without a resistance-training tempo control.

### Resistance table geometry

No extra inner card padding: table width equals screen content width.
At content width 350, columns and gaps must be exactly:

| Column | Width | Start x, relative to table | Alignment |
| --- | --- | --- | --- |
| Set | 28 | 0 | Center |
| Last | 86 | 32 | Left |
| kg / lbs | 60 | 122 | Center |
| Reps | 60 | 186 | Center |
| RPE / RIR | 52 | 250 | Center |
| Done | 44 | 306 | Center |

Five gaps of 4; total 350. Header min-height 28; set row min-height 52; inputs
48 high, inset 2 vertically; subtle rule below rows. Last is aligned to the left
edge of its content, not the center of the column. Headers align to fields below.
Values are centered in numeric fields. The completion mark is visually 20 inside
a 44-wide row target, not a giant filled square.

At content width 320, use widths 24 / 76 / 54 / 54 / 48 / 44, five gaps of 4.
For widths between 320 and 350, distribute additional width proportionally across
Last and numeric inputs. Above 350, grow Last and inputs; do not grow checkboxes.
Below 320, or when font scaling makes the table unreadable, use stacked set rows:
`Set 1` + `Last 105 kg x 3` above a row of labeled Weight/Reps/Effort/Done fields.
Do not introduce horizontal scrolling for the entire workout page.

### Row states and behavior

| State | Visual treatment | Required behavior |
| --- | --- | --- |
| Planned | Surface inputs, blank completion mark | Editable; not falsely recorded as done |
| Focused | Accent border only around focused field | Cursor stays in that field after deletion or update |
| Completed | Ink-filled check with on-primary tick; subtle row surface | Values remain readable and editable under existing rules |
| Warmup | `W` marker and accessible warmup label | Not silently converted to a working set |
| No previous set | Last shows dash | No invented load, effort or fabricated comparison |
| Deleted | Row removed; inline `Set deleted` / `Undo` below that exercise | Existing Undo behavior, not an unrelated page toast |
| Invalid numeric input | Field error after meaningful validation | No disruptive keystroke-level alert or cursor jump |

- Last remains tappable to copy that set's supported previous values. Give it a
  small underline or distinct actionable treatment; accessible label names the
  exercise, set and copied values. Never copy automatically on focus.
- Include that corresponding previous set's recorded effort in Last when known:
  `105 x 3 @ 10` for RPE, or `105 x 3 @ 0` for the equivalent RIR preference.
  The `@` value follows the user's global effort scale. Screen-reader labels
  explicitly say RPE or RIR. Omit the suffix when effort was not recorded; never
  invent a previous effort or populate today's blank effort field merely to
  display history. Retain set-specific loads, reps and effort. Allow two lines
  within the Last cell for longer values rather than shrinking its font.
- Newly added exercise effort fields remain blank; the global RPE/RIR preference
  controls labels, display and accepted values. RPE 6-10 corresponds to RIR 4-0.
- Keep mixed loads and reps per set; never summarize three different sets as a
  uniform prescription when applying guidance or displaying history.
- Add set and Duplicate last set are separate minimum-44-high actions below table.
- Do not permanently add another delete icon per row. Set marker opens compact
  set options; preserve existing supported set types and deletion.

### Cardio and bodyweight

- Cardio uses its applicable time/distance controls and units, not resistance
  load/reps/effort columns copied verbatim. Include zone selector when expanded.
- Place the shared Done checkbox to the right of time/distance inputs at normal
  size. It completes the cardio session; do not add a separate Mark session
  complete button. At 200%, reflow fields and a labeled Done row consistently.
- Zone, Session type and Effort level may all be unset; tapping the selected
  option again clears it. No `Not set` pill and no repetitive `(optional)` suffix.
- Bodyweight exercises must not receive fictitious kg values. Guidance must name
  reps/sets/effort changes where appropriate; preserve additional-load semantics
  if the user explicitly logs external weight.
- Missing time, distance, zone or effort is an empty value, not an invented zero.

### Exercise menu

Compact content-height sheet; never a screen-sized empty panel. Header is exercise
name plus Close. First action row: reorder icon, `Up`, `Down`, with equal visual
weight. Disable unavailable boundary actions. Place before Replace exercise.
Follow with supported exercise settings and Delete exercise last, separated by a
rule and danger color. Preserve current labels; do not casually rename Delete.
Do not introduce drag-to-reorder in this design pass.

## 7. Timers and active workout behavior

- Session timer lives in session heading; tap opens existing adjustment controls.
  Pause/resume are explicit controls in that view, not an unlabeled clock icon.
- When rest is active, dock a 56-high row above bottom navigation: exercise name,
  remaining time, Pause/Resume, Skip. Long names truncate here only; full name is
  accessible in the timer detail. At narrow widths, use a two-row dock up to 88.
- Timer detail opens from the countdown, with presets and custom duration.
- When keyboard is open, hide the dock's expanded controls to protect input space;
  keep countdown discoverable in exercise Rest control. Do not pause the timer.
- Reserve scroll padding equal to actual nav + dock + safe inset, not a guessed
  fixed number. Last row and Add exercise must scroll fully above the dock.
- Background/lock catch-up, pause/resume and draft restoration remain unchanged.
- Announce timer completion once, not every second. Never depend on animation,
  background JS cadence or automatic notifications not already implemented.

## 8. Today's Plan: a coaching annotation

Workout is the primary home for actionable guidance. Do not force a round trip
through Home to generate, review or apply it. Show one compact row above entries,
not a large promotional card above the training log.

| State | Compact row copy | Sheet action |
| --- | --- | --- |
| No plan | `Today's Plan` / `Review` | Generate/review with existing disclosure rules |
| Generating | `Reviewing today's workout...` | Busy, no repeated request or premature Apply |
| Fresh, no changes | `Train as planned` | Back to workout |
| Fresh, changes | `4 exercises adjusted` | Apply changes |
| Stale | `Workout or context changed` | Update today's plan |
| Applied | `Changes applied` | Back to workout; Undo when supported |
| Failed | `Couldn't review this workout` | Try again; workout remains editable |

Sheet order: title/Close, short result, actual exercise changes, optional grouped
reasons, Edit today's inputs, primary action. Do not repeat the headline as a
subtitle and a count and an all-caps badge.

- Show concrete before/after differences for affected working sets, preserving
  mixed sets. Group the same reason once for affected exercises.
- Keep detailed reasoning collapsed under `Why these suggestions?` by default.
- Unchanged exercises do not require a paragraph each.
- Show caution only when supported by reported context; no universal pain warning
  after a user reports no pain. Clinical caution never becomes a decorative motif.
- Use note/annotation icon, not a large sparkle graphic or yellow-filled panel.
- Retain explicit user confirmation before changing a workout. Preserve completed
  and warmup sets, available-weight rounding and existing Apply/Undo guards.
- Do not imply an AI explanation is a clinician's advice or a measured fact.
- Mockups show real states of disclosure, busy, error and stale handling. Do not
  invent a faster service latency or hide errors behind permanent skeletons.

## 9. Setup, search, history and completion surfaces

### Choose routine and recommendations

Choose routine opens a bounded sheet with Search, routine list, Repeat past
workout and Create routine. Each row shows name and concise exercise/set summary.
Deload remains explicitly labeled; do not offer to overwrite its source routine
after completing a deload session.

Recommend workout opens a sheet with focus selection and Quick/Standard/Extended,
then `Recommend workout`. Use real supported choices; long focus lists wrap or
scroll in the sheet, not off the edge of the main workout. Any volume reduction
must be explained once with actual resulting volume, not an inconsistent promise.
After loading, show a compact source/summary; details are expandable.

### Add exercise

- Sticky sheet/page title `Add exercise`, Close/Back, search below with a visible
  clear button whenever nonempty. Clear must clear immediately.
- Selected removable chips directly below Search; count and `Add (2)` action
  remain visible above keyboard/system navigation.
- Results show exercise name and useful equipment/muscle metadata; no ornamental
  images at the expense of the result name. Custom exercise stays discoverable.
- Align the results area's outer side margins with the search input's outer
  edges; do not run list dividers to the screen edge beneath an inset search.
- Preserve multiple selection and current custom-exercise keyboard behavior.
- Loading, no matches and error states each have distinct copy and recovery action.
- Selection does not change because a result disappears under a different query.
- Add and Replace share relevance rules: exact exercise names and genuine aliases
  precede partial title and muscle/equipment matches. Require all query terms;
  support common equipment abbreviations and joined/hyphenated exercise names.
  Do not use arbitrary letter subsequences to fill a no-match list.
- Replace keeps substitution suggestions for an empty query. Once searching,
  show matching results only, respect the selected category, and let All search
  every body part. Exclude the current exercise; never replace it on search alone.
- Empty-query suggestions put named variations of the same movement before
  generic muscle/equipment matches. All includes these variations across catalog
  body-part labels (e.g. Back and Legs deadlifts); explicit body-part filters stay
  strict. Generic compound/isolation labels do not establish movement similarity.
- Apply the same relevance gate to every catalog entry, including unfamiliar
  names: require a named family, a specific movement-pattern/primary-muscle match,
  or a meaningful name/primary-muscle match. Keep mobility, resistance, plyometrics
  and cardio separate. Do not pad a short list with same-category exercises;
  offer explicit search when no close catalog alternative exists.

### History and progress

Exercise-name tap opens history with title/Close, compact progress/PR summary,
chart where meaningful and sessions in reverse chronological order. One set per
row within each date, never a dense inline paragraph of all sets.
Estimated 1RM remains labeled as estimated. Show units and sparse-data empty
states honestly; do not invent a smooth trend from one record.

### Set options and other sheets

- Height fits actual content, bounded by available viewport (maximum 85% when
  necessary), with an internal scroll area rather than empty tall sheets.
- Heading/Close is outside body scrolling where practical. Actions remain
  reachable. Android Back and outside tap dismiss non-destructive sheets.
- Popup cards stay above the persistent bottom tab bar, with 12 dp clearance;
  use the actual tab-bar height, including its safe area, rather than adding
  the Android inset twice. With the keyboard open, reserve keyboard space
  instead of also reserving hidden tabs. Tall content scrolls within the card.
- Detached/floating sheets round all four corners, including Today's Plan,
  Workout input sheets and available weights; do not leave square bottom corners.
- Backdrop dismiss targets are siblings of the card, never touchable ancestors
  around its content. Touching text, whitespace, charts or inputs inside a card
  must not dismiss it. Outside dismissal never saves or applies changes and
  must respect an in-flight save guard.
- Loading/saving status gets a reserved layout slot or replaces button copy;
  do not move choices and Cancel when status text appears.
- Filtering a chart updates its existing viewport without blanking, remounting
  or delayed corrective scrolling. Date histories start at their newest records
  and retain chronological visual order. Prefer a windowed, right-anchored list
  over rendering the entire history and jumping after it becomes visible.
- Profile preview content is centered within the card's scroll content, not
  merely on its outer container. Badges hug their text rather than stretching.
- If unsaved work would be lost, use explicit discard handling consistent with
  existing behavior. Do not pretend that every modal is swipe-dismissable today.
- Gesture dismissal, if added, must not compete with form scrolling or cause
  accidental draft loss. It is not required for the first mockup implementation.

### Finish and discard

1. Finish opens review with session title/date, actual completed volume and Save.
2. Saving prevents duplicate submission; failure keeps the draft and offers retry.
3. Save success is unambiguous: `Workout saved`, with a persistent acknowledgement
   action rather than a blink-and-miss banner.
   Place the success checkmark and title on the same row (section 4).
4. Only then offer the existing optional source routine update, when applicable.
5. Confirm `Routine updated` distinctly, without implying saving required updating.

Discard is a separate confirmation: title `Discard workout?`, concise loss
description, stacked full-width `Keep workout` and `Discard workout` actions.
Do not invent autosaved cloud recovery. Completed data is never destroyed just
to dismiss a design prototype.

## 10. Keyboard, rotation and responsive rules

### Reference frames

| Frame | Purpose | Main width rule |
| --- | --- | --- |
| 390 x 844 | Primary phone portrait | 20 inset; 350 content |
| 360 x 800 | Compact phone | 20 inset; 320 content |
| 844 x 390 | Phone landscape with keyboard variant | 20 inset; centered max 760 |
| 800 x 1280 | Tablet portrait | Centered max 760 |
| 1280 x 800 | Tablet landscape | Centered max 760; no forced side dashboard |

These dimensions are mockup fixtures, not orientation locks. System insets reduce
available space. Keep a single exercise-reading order; do not split the workout
into unrelated columns merely because a tablet is wide. Sheets cap at 560 unless
a particular dense history view is explicitly designed otherwise.

- Test tables at default and enlarged text. Switch to stacked rows when required
  by content, not only by device-name detection.
- With keyboard open, the focused field must automatically become visible and
  remain visible after rotation. Manual scrolling is fallback, not the target UX.
- In short keyboard windows or enlarged text, a fixed footer must not consume the
  entire editor. Move actions into the scrollable body when needed so an active
  field remains visible and actions remain reachable. Retain Android Back dismissal.
- Preserve selection, caret, raw input string and exercise order through rotation.
- Android native inputs disable fullscreen/extract editing; the actual workout
  remains visible instead of becoming a white system editor.
- Do not double-subtract keyboard height when Android already resizes the window.
- Numeric pad must allow decimals for weight where supported. Reps/effort retain
  existing validation; keyboard labels alone do not validate values.
- Do not focus weight because reps changed or because an async history read ends.
- Bottom tabs may be hidden while keyboard is visible to preserve working space;
  this is a proposed presentation change, not a reason to reset navigation state.
- See existing [keyboard guardrails](keyboard-modal-guardrails.md) and
  [adaptive layout notes](android-adaptive-layout.md). Retain their protections.

## 11. Accessibility and inclusive use

- Target at least 4.5:1 contrast for normal text, 3:1 for large text, and 3:1 for
  necessary interactive boundaries/indicators. Measure actual rendered pairings.
  Decorative rules may be subtler only if they convey no essential information.
- Minimum targets: 48 x 48 generally; named compact-header/help exceptions are
  44 x 44 and dense table cells are at least 44 x 48. Use the role table in
  section 3 instead of inventing a new exception. Enlarged controls must also
  meet their explicit targets. Hit slop must not overlap adjacent inputs.
- Never use color, a blank checkbox or an unlabeled icon as the only explanation.
- Screen-reader order follows visual order, exercise by exercise and set by set.
  Example: `Bench press, set 2, reps, 5`. Completion announces checked state.
- Editable number labels must include units and the global effort scale.
- Charts have textual latest, date and change equivalents; no hover-only detail.
- At 200% text, double history chart label and point rendering sizes using a
  wider horizontally scrollable plot. Preserve observation spacing and enlarged
  tap targets rather than squeezing enlarged labels into the original plot width.
- Open history with the latest observation selected and its point in view.
  Recenter the selected point when plot dimensions change; preserve deliberate
  horizontal scrolling during unrelated updates, allowing older records to be reviewed.
- At 200% text scale, use reflow/stacked layout rather than clipped text or tiny
  type. Check long names, Korean names and large numeric values.
- Stacked sets use a full-width set heading and Last entry, followed by aligned
  label/input pairs and a labeled Done row. Keep control alignment deliberate;
  enlarged text is an accessibility requirement, not an excuse for displaced buttons.
- At 200% text, the completion box is 36 x 36 within a minimum 64-high target,
  with a 28-wide checkmark. Routine/Change and Today's Plan/Review share 28/40
  typography and matching top padding so first text lines align even when labels
  wrap. Actions remain top-aligned and right-aligned, never vertically centered
  against a multiline label. Enlarge supporting control icons to 24 and give
  stacked sets a small internal inset so fields do not touch completed shading edges.
- At 200%, related metadata/actions use 28/40 first-line alignment. Help retains
  the shared information icon and its full target. Two-column comparisons and phase
  selectors stack; a set becomes an intentional labeled form, not a broken table.
- Larger fonts do not excuse displaced controls. Inspect label/action baselines,
  checkboxes, focus outlines, chart selection and modal footer reachability at
  200%, not only whether the text fits inside the screenshot.
- Reduced motion removes nonessential transitions; no haptic-only status.
- Neutral, nonjudgmental copy. No shaming food labels or heroic pushing through pain.

## 12. Copy, icons, data and feedback rules

- Brand text: `Lastrep` or `lastrep`, never `LastRep`.
- Plain verbs: Add, Edit, Save, Choose, Apply, Undo, Delete. No metaphorical labels
  such as Ink it, Tear out page or Write your destiny.
- Preserve established control names unless a change is explicit in this document.
- Icons must use the vocabulary, size roles and optical-weight rules in section 3.
  Native library glyphs may be reused when they match that approved treatment;
  do not restore a rejected glyph merely because it is already in the codebase.
- Units are explicit at the column/field level. Respect kg/lbs and RPE/RIR settings.
- Missing values use dash or helpful copy; zero is shown only when it is data.
- Use user locale for dates and numbers; fixture English formatting is illustrative.
- Destructive and success dialogs stack full-width buttons with 8-12 spacing,
  readable labels and no horizontal three-button squeeze.
- Inline validation is next to the affected field. Network errors retain inputs.
- Explicit Profile sync results use a polite live region and become fully visible
  above the bottom tabs, including multiline/no-data results. Coordinate reveal
  with settled scroll-content size; preserve ordinary page scrolling afterward.
- Loading does not briefly show first-user empty states to returning users.
- A skeleton represents pending data, not an assertion that no records exist.
- Never show internal SDK/build instructions, package hashes or developer setup
  errors to an end user. Offer a plain-language recovery action instead.

## 13. Extending the system beyond Workout

Use shared tokens and controls, but do not force every screen into a set table.
The following order and behaviors guide later mockups; verify current feature
inventory before implementing any relocation.

### Home: today's page

- Header: existing logo with accessible name, date and profile entry.
- Compact current training/diet phase controls with week counts; changes must
  remain synchronized with Profile and existing phase history behavior.
- Primary next action based on current context, not a grid of every possible CTA.
- Progress section with weight/body-composition chart and explicit Add/Edit path.
- Readiness, Weekly trends and Complete today's picture retain headings inside
  their own grouping when those are panels. No floating orphan headings.
- Calendar becomes a concise record index: clear day numbers, today outline,
  recorded-workout indicator, selected state and accessible full-date labels.
  Day tap opens workout/rest detail; closing detail returns to calendar.
- Today's Plan may have a compact entry link if useful, but no second independent
  plan generator or repeated exercise-change wall on Home.
- Phase/context facts must not masquerade as a medical readiness score.
- Home recovery check-in and Workout's Today's inputs are two entry points to
  the same date-scoped recovery/context state: ratings, discomfort, additional
  activity and daily note. Use one shared form and explicit Save/Cancel behavior.
  Changed inputs make existing guidance stale; they must not silently apply a
  different workout. Context is not a second set of independent Home-only answers.
- Profile entry retains the user's photo (initial fallback), name and optional
  profile description. Do not expose private daily/recovery notes as profile text.

### Nutrition: food diary

- Date header, energy summary, protein summary, then meal entries with logged time
  in a stable left column and user-chosen meal names. Preserve meal label settings.
- Use narrow rules and section headings rather than six large floating meal cards.
- Energy/protein consumed and target labels stay within bar bounds, share a
  baseline and do not overlap at zero or near target. Remaining is header text.
- Macro fills use muted sage #A8BEA6, sand #CDB78F and slate #B2B7BE in both modes.
  Keep percentage and companion labels in high-contrast ink; pale fills are not
  suitable text colors on paper. This internal-test refinement awaits visual review.
- P/C/F gram labels identify segments in a stable order; percentages inside only where they
  fit at readable size. For narrow segments, place the percentage in an accessible
  companion label instead of squeezing text. Consumed and target use same order.
- Labels below segments align with segments when space permits; avoid collisions
  using a consistent fallback legend, not unreadably small text.
- Editing and search use identical quantity-editor shell, spacing and typography.
  Recorded edit opens in grams at actual quantity; unit switches convert values.
- Confirmed selection summary must update outside the popup, too. Keep nutrition
  facts accessible before adding and when editing an already logged item.
- Preserve saved meals, copy previous meal, camera denial/manual barcode fallback,
  missing product messaging, editable log time and swipe deletion behavior.

### Sleep: recovery journal

- Date, main duration, source/status, then session timing and history/trend.
- Saved account data may remain visible while current-device sync is disconnected;
  label stored record date separately from current connection status.
- Distinguish `No saved data`, permission unavailable, loading and read failure.
- No illustrative sleep stages or inferred clinical quality score without data.

### Profile and Settings: functional notebook back matter

- Account/photo, health sync, preferences, TDEE and other existing settings use
  consistent label/control rows. Do not sacrifice discoverability to mimic paper.
- Keep meal naming in Nutrition, not a second Profile preference card. Preserve
  explicit Save/Discard for staged Profile edits.
- Health consent, permissions and sync timestamps remain separate concepts.
- Health sync shows one short permission instruction. Put per-device permission
  and source-app sharing details behind a header help icon, using a few brief
  paragraphs. Do not repeat ready/status rows as explanatory prose or add a
  separate long How to grant access walkthrough.
  Health/scale apps may be named as conditional examples; do not promise every
  app exports every measurement or older records. Briefly explain current sync
  limits in help: past 30 days for sleep, latest values for body measurements.
- Legal/contact links use the same icon slots and text alignment as account rows.
- Subscription, restore and developer-build isolation retain verified outcome
  messages. Restore never promises ongoing verification without evidence.
- Preferences use the same typography as other screens; lengthy explanation is
  progressively disclosed, not pasted under every button.

### Charts, body composition and records

- One latest daily body-data point where existing rules require it; date labels
  include month at boundaries. Equal point spacing is acceptable for measurement
  history only if date labels clearly communicate irregular sampling.
- Connect actual observations, not invented daily values. Do not smooth sparse
  body-fat readings into an apparent continuously measured curve.
- Selected point has a visible ring and a larger invisible target; horizontal
  scroll gives crowded observations room. Show date/value outside the chart too.
- Switching metric reveals its latest actual measurement, not blank recent dates.
- Weight preserves up to two recorded decimal places. Lean body mass and skeletal
  muscle mass are separate metrics with definitions, never silently merged.
- Point tap selects; Add/Edit is explicit and clarifies chosen date versus today.
  Preserve deletion, existing values, examples and unit conversion in the editor.

### Brand and app variants

- Existing wordmark geometry is the baseline. Do not redraw it in the title font.
- Production retains its approved gradient logo; dev retains orange-to-red gradient
  with identical geometry. Logo gradient is a brand exception, not a UI palette.
- Match optical size between variants. Do not stretch the wordmark or introduce
  fake handwritten branding. App/splash assets are separate approval scope.
  The native launch/splash background is black (`#000000`) in both appearance
  modes and both app flavors, matching the black around the existing logo.
  Keep the production and dev logo artwork distinct.
- Home and native startup share one vector outline of Home's Android
  sans-serif bold lettering. Keep Home's header geometry. Hold the native splash
  until the focused destination has rendered with its fonts and Home's initial
  profile/insight/health-status reads have settled. Do not show a second branded
  loading screen or add a minimum logo duration. A stalled Home read may release
  after eight seconds into the screen's normal loading/error state, so offline
  startup cannot leave users trapped on the splash. Signed-out and incomplete
  accounts reveal their authentication/onboarding destination instead of Home.
  Reveal the prepared screen directly, without fading the black splash through
  the light notebook canvas; the default native fade was perceived as a flicker.
  Native startup may enlarge the wordmark modestly (112dp wide), centered within
  Android's 288dp canvas / 192dp safe circle. All visible artwork must fit inside
  the mask. Launcher icons remain separate from splash artwork.

## 14. Mandatory mockup package

Create a focused Workout package before redesigning every screen. Each frame must
name its viewport, theme, text scale, data state and keyboard state. Use reusable
tokens/components; include interaction notes and explicit open questions.

### Fixture data

Date: Thu, Oct 15, 2026. Workout: Chest + Triceps. Phase: Hypertrophy. Units: kg.
Effort: RPE. Timer: 18:42. No reported pain in baseline frame.

| Exercise | Previous working sets | Current planned/logged sets |
| --- | --- | --- |
| Bench press | 105 x 3 at RPE 10, three sets | 100 x 5, three sets; first complete; effort blank |
| Incline dumbbell press | 30 x 8, 28 x 10, 28 x 9 | 30 x 8, 28 x 10, 28 x 9; all incomplete |
| Cable fly | No history | Load blank, reps 12, two sets; effort blank |
| Tricep pushdown | 35 x 10, three sets | 35 x 10, three sets |

These are synthetic layout fixtures, not a recommendation endorsed as appropriate
for that prior performance. Include a separate bodyweight/cardio fixture rather
than pretending this resistance table proves every exercise type works.

### Required frames and annotated states

1. Empty Workout, 390 x 844, paper: every setup path discoverable.
2. Active Workout, 390 x 844, paper: header, metadata, first full exercise and next
   heading visible. Do not shrink type to hit an arbitrary exercise count.
3. Same active frame, dark: exact hierarchy, different semantic token values.
4. Reps field focused with keyboard open: visible caret in reps, no weight jump,
   last-row editing reachable, no obscured field or accidental completion.
5. Rest running: timer dock, scrolled exercise and last-row clearance.
6. Compact set-options sheet and exercise menu, including reorder boundary state.
7. Add exercise with query, removable selected items, keyboard and Add count.
8. Today's Plan no-change, changed, stale, applied and failed variants; same sheet
   component, concise deltas, grouped explanation and genuine caution only.
9. Finish review, saving failure, Workout saved, optional routine-update sequence.
10. 360-wide and landscape-with-keyboard stress frames; one enlarged-text stacked
    row example. Include a tablet composition, not just a scaled-up phone image.
11. Cardio controls with unset and selected zone/session/effort states, plus
    bodyweight entry and no-history/custom-exercise demonstration state.
12. History/progress sheet: sparse history and multiple sets shown on separate rows.

For the first visual review, prioritize frames 2 and 4 side by side with current
UI captures. The remaining states are required before calling the design complete,
not necessarily before choosing between initial visual directions.

If exploring variants, vary only title treatment or section framing while keeping
data, typography minimums and layout tasks constant. Do not compare one beautiful
empty screenshot against a realistic densely populated current screen.

## 15. Review rubric and acceptance gates

### Visual gate

- Looks like a deliberate training tool, not a themed generic dashboard.
- Exercises and numbers dominate; setup and AI assistance do not overwhelm them.
- Paper/dark versions have the same hierarchy and component geometry.
- No arbitrary gradients, ornamental notebook effects or repetitive card nesting.
- Screenshot contains believable long names, uneven sets and missing values.

### Usability gate

In a clickable prototype, verify that a user can locate the next incomplete set,
edit reps, check a set, inspect Last, add an exercise, pause rest, finish and recover
from a mistake. Compare task time, first-tap errors, scrolling and comprehension
against the existing app; do not claim improvement based on visual preference.
Targets: no lost data/focus, no hidden critical control and no increase in steps
for normal set logging. Collect user reactions rather than asserting nostalgia
appeals equally to all lifters.

### Engineering gate before rollout

- Keep current tests and add layout/interaction coverage for changed boundaries.
- Android-native and JS set rows share tokens, dimensions and effort semantics.
- Native source and its maintained override must stay consistent.
- Focus/keyboard regression checked on a real phone; typecheck is not a substitute.
- Recheck draft restore, mixed sets, Apply/Undo, deload, finish/update sequencing,
  unit preferences, history and native input behavior after visual changes.
- Font/text measurement and rotation checked before broad adoption.
- No new per-keystroke Firestore reads, per-second whole-page re-renders or heavy
  decorative assets. Profile the populated view; do not infer speed from mockups.
- Release-build/internal-test checks remain necessary for native font/input edits.

### Implementation map (current repository)

| Area | Existing entry point / constraint |
| --- | --- |
| Workout orchestration | `app/(tabs)/workout/log.tsx`; avoid another monolithic redesign |
| Session | `src/workouts/workoutLog/WorkoutSessionCard.tsx` |
| Routines | `src/workouts/workoutLog/WorkoutRoutineSection.tsx` |
| Recommendation | `src/workouts/workoutLog/WorkoutRecommendationSection.tsx` |
| Guidance | `src/workouts/workoutLog/WorkoutTodayPlan.tsx` |
| Native row adapter | `src/workouts/workoutLog/WorkoutNativeSetRows.tsx` |
| Native implementation | `android/app/src/main/java/com/kjeehwan/lastrep/workoutnative/WorkoutSetListView.kt` |
| Maintained native override | `native-overrides/android-kotlin/workoutnative/WorkoutSetListView.kt` |
| History insights | `src/workouts/workoutLog/ExerciseProgressSummary.tsx` |
| Timer behavior | `src/workouts/workoutLog/timerClock.ts`, `TimerText.tsx`, `useWorkoutElapsedTimer.ts` |
| Draft persistence | `src/workouts/workoutLog/useWorkoutDraftPersistence.ts` |
| Modal infrastructure | `src/ui/AdaptiveModalCard.tsx`, `src/ui/KeyboardAwareModalFrame.tsx` |
| Brand wordmark | `components/LastrepLogo.tsx` |

This map identifies starting points, not an exhaustive audit of current behavior.
Introduce shared semantic tokens with a clear native mapping rather than copying
new hex codes into every screen. Do not change data schemas or recommendation
algorithms as part of applying the visual system.

## 16. Delivery sequence and decisions to validate

1. Preserve the approved Workout/Home/Nutrition browser baseline and shared rules.
2. Next: mock up Profile/Settings using the same rules before native implementation.
3. Resolve remaining screen-specific design questions without changing verified
   logging, consent, billing or data semantics as part of visual cleanup.
4. Implement Workout in an isolated branch, preserving verified behaviors.
5. Device-test and compare with current UI; fix regressions before broad rollout.
6. Extend shared system to Home/Nutrition/Sleep/Profile in separate reviewable batches.

Decisions to validate in mockups:

- Paper theme as launch default versus retaining the user's current theme.
- Serif title character and font legibility on actual Android renderers.
- Discoverability of setup actions moved out of the populated log.
- Header Finish placement and session overflow discoverability.
- Table density versus larger targets, especially at increased font scale.
- Rest dock usefulness versus viewport cost with five bottom tabs.
- Whether users understand Last as a copy action without a tutorial.

Do not defer fundamental readability or focus integrity to these preference
decisions. Those are acceptance requirements, not optional stylistic tradeoffs.

### Change control

Update the relevant shared rule when review resolves a reusable pattern; do not
append a contradictory screen-only exception at the bottom of the document.
If a deviation is truly screen-specific, name the role, constraint and affected
screen. Keep historical artifact notes separate from current requirements.

Before approving another screen or a visual change, verify:

1. Every icon maps to a named role, drawing and target; no arbitrary per-screen size.
2. Equal visible gaps where intended; repeated actions/inputs share their edges.
3. Help glyphs are centered in their real targets, using the label's typography.
4. Default and 200% layouts remain aligned and operable, not merely unclipped.
5. Recorded values/dates, missing data, selected history and units remain truthful.
6. Relevant state is shared between entry points; Save and Cancel have clear effects.
7. A visualization answers a specific question and discloses its period/denominator.
8. Loading, error, empty, saved and destructive states use the same component grammar.
9. Prototype limitations are disclosed; screenshots do not substitute for native QA.

## 17. Initial Figma mockups

Created October 15, 2026 from version 1.0; revised to match version 1.1 following
the user's first layout review:

- [Side-by-side visual review](https://www.figma.com/design/DmOV6UcDygYzn4z88BeHA6/Lastrep-Training-notebook?node-id=3-3217)
- [Active Workout, 390 x 844](https://www.figma.com/design/DmOV6UcDygYzn4z88BeHA6/Lastrep-Training-notebook?node-id=3-3224)
- [Reps editing with keyboard, 390 x 844](https://www.figma.com/design/DmOV6UcDygYzn4z88BeHA6/Lastrep-Training-notebook?node-id=3-3617)

The file contains editable layers, paper-theme semantic variables, shared text
styles and reusable inputs, completion marks and action components. It uses the
Source font pairing, the specified 350-wide set table and the synthetic session
data above. All four fixture exercises remain in each scrollable ledger.

Limited prototype links: tap Bench press / Set 2 / Reps in the active screen to
open the editing state; tap the illustrative keyboard to return. This does not
implement real typing, timers, saving, Finish, menus or other app interactions.
The Material library keyboard has neutral presentation overrides and is only a
placement illustration; actual device IME appearance and behavior may differ.

Both frames were rendered and visually inspected. The focused reps field has
82 dp clearance above the keyboard in this fixture. This is mockup geometry,
not proof that native keyboard avoidance or focus behavior works on a device.
At the time of this Figma revision, dark mode and other states were still pending.
They were subsequently explored in the browser (section 18); they were not
retroactively added to Figma. No application code or runtime behavior was changed.

Version 1.1 mockup revisions: increased Workout toolbar spacing, removed the
remote `Timer running` label, aligned Review with Change, equalized the three
exercise-control targets and displayed recorded previous-set effort in Last.
Both revised frames were rendered and inspected; right label edges match,
the example Last values fit at 14 sp and focused-field clearance remains 82 dp.

## 18. Local browser prototype

Figma's Starter-plan MCP quota blocked creation of the remaining frames. The user
approved continuing in a separate browser prototype and bringing both approved
screens into it. The additional states are local browser views, not Figma frames.

Location: `prototypes/training-notebook/`.
See its [run and review guide](../prototypes/training-notebook/README.md).

```powershell
node prototypes/training-notebook/serve.mjs
```

Open **http://127.0.0.1:4317**. This is a laptop-only loopback server, independent
of Metro. The initial view compares the approved active screen with the approved
editing layout, recreated as HTML rather than flattened screenshots.

The state picker contains 47 examples across setup/search, active controls,
Today's Plan, history and exercise types, completion and responsive checks.
Dark mode, compact phone, landscape keyboard, 200% stacked rows and both tablet
sizes can be inspected without changing the app. Optional viewport and effort
controls also allow combinations to be checked.

Implemented mock interactions include set editing, Last copying, completion,
reordering, add/duplicate/delete/Undo, selected search chips, custom exercises,
cardio toggle clearing, timers, check-in/disclosure, guidance Apply/Undo and the
separate save-then-routine-update flow. Recommendations, records and service
outcomes are synthetic; no real AI or account services are invoked.

Review this as a design/interaction prototype. Fonts are bundled for offline use.
Most edits stay in memory. Saved recovery check-ins use same-tab session storage
to share context with Home (section 19); no records are sent to a service.
Switching examples or Reset example clears shared context and resets the fixture.
Simulated keyboard geometry and browser focus checks are not evidence of native
Android keyboard, touch, lifecycle or accessibility correctness. Live media,
other app tabs, actual saving and recommendation algorithms are outside scope.
Lastrep's application code, routes, dependencies and backend remain unchanged.

## 19. Home browser study: approved review reference

Open **http://127.0.0.1:4317/home.html** using the same local server. This is a
separate study linked from the Workout review sidebar; it does not replace an
app route. The user approved its direction and subsequent refinements through
October 16, 2026. Its files are `home.html`, `home.css`, `home.mjs`,
`home-model.mjs` and `home.verify.mjs` beside the Workout prototype.

### Inventory and hierarchy

The current `app/(tabs)/home.tsx` was inspected before composing this study.
The study retains its calendar/settings/profile entry, training/diet phase
controls, first-user Get started, workout shortcut, conditional context actions,
Progress, Readiness and Weekly Trends. It does not generate Today's Plan on Home.

1. Sticky identity/navigation header: current production gradient logo treatment,
   Calendar, Settings and profile initial; 24-high illustrative system-bar inset.
2. Date and daily-page title: October 15, 2026, `Your daily record.`
3. Two compact phase selectors: Training / Hypertrophy / Week 3 and Diet / Bulk /
   Week 2. Fine rules, not another Current phases card.
4. One primary workout action: Chest + Triceps, 4 exercises, 11 working sets,
   1 complete; Continue workout links to the existing Workout study. With no
   plan, use Start workout. An empty plan is not an assertion of a rest day.
5. Complete today's picture appears only for an unlogged meal or disconnected
   health sync. Header is inside a lightly outlined surface panel. No completed
   task checklist remains when both actions are irrelevant.
6. Progress is a ledger section with a top rule, heading/Add-edit action,
   measurement-type tabs, selected value/date, chart and source. No inner chart card.
7. Readiness keeps its heading, score, explanation, four inputs and Edit recovery
   check-in inside a lightly outlined panel. The 88% fixture uses the current
   weighting, not a new scoring algorithm. Missing inputs produce an explicit
   insufficient-information state rather than a fabricated score.
8. Weekly Trends is a four-row ledger: workouts, average session volume, average
   logged calories and average recorded sleep. Comparisons use neutral text,
   not red/green judgments. Tapping a row opens its metric meaning and examples.

Native Home feature inventory is preserved, but this is not a proposal to change
the app's calculation or query behavior. Weekly values and day logs are synthetic
design fixtures, not production analytics verification.

### Home-specific geometry and behaviors

- Use the same paper/dark tokens and bundled Source fonts as Workout. Content
  uses 20-dp horizontal insets, a 760 maximum width and a sticky bottom tab bar.
- Phase selectors share a two-column ruled strip: 12 vertical padding, 16 gap
  from the central divider, 13 label/week, 16 semibold value. At 200%, stack them.
- The workout section has a 3-dp accent rule on its left, 16 internal left space,
  26/32 serif title and full-width primary button. No nested promo tiles.
- Section headings use 20/26 sans semibold. Surface panels have a quiet 1-dp
  rule, 8 radius and 16 padding. Ledger sections use 20 vertical spacing.
- Progress tabs: Weight, Body fat, Lean mass, Skeletal muscle. Use an underline
  selection rather than colored pills. The selected value uses 28 sans semibold;
  source/date remains explicit and missing measurements never display as zero.
- Measurements are equally spaced observations, not an evenly sampled timeline.
  Use 64-dp point spacing, 22-radius hit areas, explicit month labels at changes,
  and latest actual observation selected when switching metrics. Body fat is
  sparse (May/July); lean mass has no records. No inferred body-fat curve for October.
- A point tap selects only. Add/edit opens the form in Add today mode and offers
  `Edit Oct 12` (for example) for an existing selected record. New fields have
  latest-value/example placeholders;
  edit fields contain actual selected values. Mode switches preserve temporary
  drafts. Numeric rows are label / input / unit, with left-aligned entry text.
- Save normalizes display units to kg, preserves other values for that date and
  exposes one latest daily observation. Delete confirms all data on the named
  date; it does not claim to delete records in a connected health service.
- Lean and skeletal muscle definitions live behind individual circled information
  controls. They are distinct metrics; no legacy generic muscle value is relabeled.
- Calendar uses Monday-first columns, today outline, recorded-workout dot and
  selected-day ink fill. Month controls have space below the dialog title.
  Tapping a date opens Workout Day or Rest Day. Closing it returns to Calendar.
  Phase names are shown in day details rather than adding colors to every cell.
- Choosing another phase starts week 1 today; choosing the current phase does
  not reset its start. Saved phases are shared with the Profile browser study.
  Historical calendar phase labels are not rewritten by today's phase change.
- Phase-picker rows are contiguous: no top margin or rounded inset that leaves
  a sliver between a selected fill and the preceding horizontal rule.
- Weekly detail puts its graph first, then Last 7 days / Previous 7 days. Workout
  and volume compare actual sessions; calories and sleep show daily date/value
  rows, coverage and explicitly labeled recorded-day averages. Missing chart
  placeholders must not be presented as measured zero values. Existing Home
  overview calculations are unchanged; do not silently relabel their denominator.
- The workout contribution grid uses 44-dp day squares with 4-dp gaps, scrolling
  horizontally to older weeks and opening at the newest weeks. Keep month labels
  and all seven weekday labels (M T W T F S S) aligned to that geometry. Do not
  rely on users inferring unlabeled rows. Future/out-of-range days are
  disabled. A day tap opens its actual details, not an edit or save action.
- At 200%: reflow phases, chart tabs, readiness inputs and measurement fields;
  enlarge chart rendering 2x and scroll to the selected point. Modal content
  scrolls independently while Close and footer actions stay reachable.

### Review states and limitations

The Home selector has 25 states, including returning/new/no plan, conditional
actions, disconnected/saved, sparse/empty, loading/error, calendar/day details,
phase selection, body-data add/edit/delete/validation, recovery check-in,
readiness information, weekly detail, profile preview, dark and 200% text.

Profile and Settings now link to their browser studies (section 22), not real
accounts or permissions. Their old selector-only destination previews remain
historical Home review fixtures. Nutrition and
Sleep link to their separate browser studies (sections 20/21); their fixtures
are not shared with Home's mock meal/sleep status.
Most record state is in memory only. Saved recovery check-ins are an exception:
same-tab session storage shares ratings, discomfort, activity and daily notes
with Workout's Today's inputs/Today's Plan. Reset example clears this saved context.
Cancel discards edits; only Save changes the shared values. Selected demo Profile
preferences also use same-tab session storage, as detailed in section 22. This is browser-only
design state, not account persistence or a backend implementation.
Body-data edits, phase changes and check-ins do not leave the browser. No Firebase,
OpenAI, health-service calls, photos, production accounts or app dependencies are used.
Native keyboard avoidance and Android touch/screen-reader behavior remain to be
tested when the approved design is implemented in the app.

### Approved decisions and shared-rule references

The October 15-16 Home and Workout walkthroughs established the following
reusable patterns. Their normative values now live in the shared sections,
not a second list of potentially conflicting screen-only tokens.

| Reviewed feedback | Governing rule | Screen-specific application |
| --- | --- | --- |
| Icon size, weight, plate order, Settings/Calendar drawings | Section 3: icon tokens/vocabulary | Same Workout drawing across every tab bar; Home compact header |
| Even button spacing, Change/Review alignment, Finish clearance | Section 4: alignment/visible spacing | Workout supporting controls; Home header/Get started |
| Help styling, centered tap area, aligned fields/units | Sections 3-4: help token/shared forms | Body composition form and future inline definitions |
| Note always visible; direct Tempo; custom demo availability | Section 6: exercise entry | Available weights remains in the three-dot menu |
| Consistent cardio Done and saved confirmation | Sections 3-4 and 6/9 | Cardio field row; checkmark alongside Workout saved |
| Honest dates and actual values when adding/editing | Sections 4/12: forms/data rules | Add today versus Edit Oct 12; no edit for an absent record |
| Sliders, discomfort, activity and note shared across entry points | Section 13: Home context | Save/Cancel semantics; stale guidance after changed inputs |
| Session comparisons versus useful charts | Section 4: visualization pattern | Two-column workout lists; selected-day volume contribution grid |
| Latest point in view, sparse data, enlarged text | Section 11: accessibility | Each metric uses its own dates; 200% plot scrolling/reflow |
| Profile photo/name/description | Section 13: Home | Initial fallback; private recovery notes never become profile text |

All future screen mockups must pass the section 16 checklist before being treated
as consistent with this design baseline. Workout, Home, Nutrition and Sleep have
each been reviewed independently. Profile and Settings are also approved (section 22).

## 20. Nutrition browser study: approved direction

Created October 16, 2026. Open **http://127.0.0.1:4317/nutrition.html** with the
same local server. Direction approved after iterative review. This is a browser
design/interaction study, not an app
implementation or an improvement to the actual nutrition database.

The existing Nutrition diary, meal detail and food-search screens were inspected
before composition. Preserve those logging behaviors, including custom meal
sections/reordering, rather than assuming only the six initial slots are allowed.

### Main diary and food-entry hierarchy

1. Sticky Nutrition toolbar, followed by centered selected date with previous/next
   controls. The date itself opens one Home-style month calendar; selecting a
   day immediately shows that diary. No duplicate toolbar calendar, nested native
   date field or View date confirmation. History rows can also select a date.
2. Calories and protein summaries: remaining/above-target text, narrow progress
   track, consumed and target values sharing a baseline below it. Units remain
   in the heading, not repeatedly attached to the numbers beneath the track.
3. Macro composition: Consumed and Recommended bars in P/C/F order, with matching
   gram-label colors. Recommended comes from the profile fixture (170 g protein,
   327.5 g carbs, 90 g fat, 2,800 kcal), not a newly generated dietary recommendation.
4. Log meals is a ledger with a stable left logging-time column, flexible name
   and right energy total. Empty sections show no invented time. Add meal creates
   another named section. Always display vertically stacked, unboxed up/down
   chevrons to the right of each entry's calories; no Reorder/Done gate. Use 20 outline
   glyphs in 44 targets (24/48 at enlarged text), with explicit accessible labels
   and disabled boundary chevrons. No visible button borders or filled boxes;
   retain keyboard focus indicators.
   Keep standard meal-row heights unchanged when reordering; controls occupy
   the existing row rather than adding a new line. Enlarged text may still reflow
   when necessary to retain readable names and full-sized tap targets.
   Foods, logging times and names move together.
   Empty meals open by tapping the meal name; omit a duplicate plus action.
   Do not repeat rename/time/copy/save in a meal-screen menu when those actions
   are already visible on the meal page; omit that redundant toolbar menu.
5. A meal detail has its name centered above the date. Foods show actual amounts,
   calories and P/C/F. Quantity/nutrition is available by tapping the food name.
   Swipe deletion retains inline Undo and a screen-reader Delete action.
   Supported foods have a visible favorite star and a direct Move icon on the row.
   Do not hide favorites or a single Move action in a three-dot menu. Move opens
   a ruled destination list with an unboxed Cancel action. Long press opens delete
   confirmation as a further fallback, without another visible Delete button.
6. Add food opens search, recent, favorites and saved-meal views. Do not show provider/source labels in result rows; dry versus
   cooked names remain explicit. Search selection and quantity review are separate.
7. Search and logged edits use one quantity-editor shell. Data source, unit
   controls, amount, equivalent summary, selected-amount nutrition and reference
   serving have distinct spacing. Per-100-g values are progressively disclosed.
   Display serving quantities as decimals throughout Nutrition: `1.5 cups`,
   `0.5 cup`, `0.125 tsp`, rather than mixed or typographic fractions. This is
   display formatting; preserve original source labels, serving weights and
   nutrition calculations. Nonterminating fractions display up to three decimal
   places for ordinary amounts without changing the underlying source amount;
   retain very small nonzero quantities rather than displaying zero.

### Geometry and data-truth rules exercised

- Reuse paper/dark semantic tokens, Source fonts, 20 content insets and 760 maximum
  content width. Header glyphs use 22 visuals inside 44 targets. Bottom tabs use
  the approved barbell and the same 22-dp outline treatment as Home/Workout.
- Amount tracks are 8 high. Default consumed/target labels are 16 and remain
  within the track width. Clamp label placement before it collides with the
  right-end target; do not clip a zero outside the track or overlap near targets.
  At 200%, labels use 28 and remain separate. Above-target totals are not hidden
  by the visually capped fill or labeled as negative remaining.
- Macro composition uses energy ratios (4/4/9 kcal per gram), not gram fractions.
  Rounded percentages total 100. Target protein remains 170 g in the fixture.
  Protein progress uses the same protein color as the composition bar.
- Bars are 28 high normally, 44 at enlarged text. Percentages appear inside a
  segment only when readable (at least 15% width in this study). Otherwise its
  percentage goes in the companion label. Do not duplicate percentages unnecessarily.
  Wide-segment labels center beneath their own segment. Clamp narrow-segment
  labels to the bar edges and shift only enough to prevent collisions (8 gap).
  Do not move all labels to unrelated equal columns. Stack only if the combined
  labels cannot fit. At 200%, use full-width legend rows.
- Approved Nutrition palette: protein olive `#4C6454`, carbs brown `#86643C`,
  fat slate `#666A70`; dark equivalents `#A8BEA6`, `#CDB78F`, `#B2B7BE`.
  Percentage text is paper on light-mode bars and dark ink on dark-mode bars.
  These deliberately restrained colors replace the more colorful first study.
- The meal ledger uses a 52-wide time column and 12 gaps; empty sections expose
  the tappable meal name rather than a duplicate plus or false zero-energy log. Reflow at enlarged text
  instead of squeezing time, long custom names and numeric totals together.
  At enlarged text, vertically center the time across the entire meal entry.
- Logging time uses a notebook-styled hour/minute list picker, not a browser
  time input. Save commits the draft; Cancel leaves the recorded time unchanged.
  Each list supports arrow keys and one keyboard tab stop for its selected option.
- On all browser studies, the review-state selector preserves the original
  order and groupings. On opening, scroll the current state to the top of the
  popup without moving it in the sequence. Scroll upward for earlier states and
  downward for later states. Support arrow keys, Home/End, Enter and Escape.
- The same quantity-editor spacing applies to a newly searched food and a logged
  food. Use 20 body gaps, 12 footer gaps, 56-high amount field, persistent Amount
  label and an external unit. Hide an empty error slot rather than creating a
  double gap. Actual selected nutrition updates while typing without replacing
  the active input or rewriting intermediate decimal text.
- Maintain canonical grams when switching display units. Reject invalid/nonpositive
  amounts without changing the log. Zero-calorie foods disable calorie-based
  quantity entry and explain that grams/servings remain available.
- Confirm amount updates staging and the search-row summary. Only Add commits
  the staged foods to this mock diary. A logged edit uses Save changes. Cancel
  does neither. Adding another amount of an already logged food merges its grams;
  the mock never silently replaces the previous recorded amount.
- Saved meals are cloned templates. Deleting one leaves logged foods intact.
  Copy previous meal names the actual source date and foods; it does not invent
  a source when empty. Copied/reused foods use the fixture logging time (18:30).

### Native Nutrition review refinements (October 17)

- Nutrition uses a fork-and-knife outline, not the earlier apple symbol.
- Keep only one divider below a subpage toolbar. The first content section must
  not add a second top rule. Later ledger sections retain their own separators.
- Center the muted, human-readable date on Add to meal. Clear search belongs
  inside the input border at the trailing end, with a 44 dp target.
- Meal ledgers use equal padding and no extra gap between ruled meal rows.
  Keep three columns: time, meal content, and vertically stacked reorder arrows.
  Center time and arrows vertically across the complete meal entry. Within the
  middle column, align meal name and calories on the first row, P/C/F on the
  second right-aligned beneath calories. On that second row, place an item
  count and caret below the name: `2 items`. Meals start collapsed; the count
  toggles an inline small-font food list without navigating. Keep meal-name
  navigation separate from expansion, with a 44 dp expansion target and an
  accessible expanded state. Omit the
  last meal's bottom rule so it does not duplicate the section divider.
  Bullets must not enter the time or arrow
  columns. At enlarged text allow the heading to wrap rather than shrink it.
- Quantity-editor actions stay outside the scrolling body above the keyboard.
  On amount focus, scroll the amount toward the top; retain scrolling for
  short landscape windows and enlarged text rather than hiding controls.
- Swipe delete shows a dustbin icon without duplicate Delete text; keep an
  explicit accessibility label and at least a 48 dp action target. Match the
  favorite and move icons: 20 dp outline with 1.5 dp stroke. Use a compact
  48 dp-wide delete button, not a text-sized action box.
- Accent-filled actions use the contrasting theme foreground: dark text on
  light coral in dark mode, light text on dark rust in light mode.
- Shared confirmations, success notices and errors on notebook screens must use
  the same sheet, fonts, colors, outside/Back dismissal and tab clearance as
  screen-owned popups. Do not leave the shared alert host in the old design.
- Copy meal names its actual behavior: the nearest earlier instance of that
  meal is appended, never substituted for existing food. Saved-template success
  feedback states the path: destination meal > Add items > Saved meals > Add.
- Swipe foregrounds must be opaque throughout the gesture so action icons cannot
  show through the delete background. Match confirmation and swipe delete
  foreground colors: dark ink on light coral, light paper on dark red.
- Source/provider labels are omitted from food rows; preserve underlying source
  records and nutrition references without adding provenance clutter.
- The off state of optional switches must have a contrasting thumb/track and
  a visible outline; it must not disappear into the sheet background.
- Keep the selected-amount minicard mounted while changing units, typing or
  clearing an amount. Derive nutrition synchronously from the available
  reference data, not through a database load or an empty intermediate render.
  Invalid amounts show dashes in the same card and cannot be saved.
- Long-press Delete uses the notebook confirmation sheet, Android Back/outside
  cancellation, a destructive action, and the existing Undo flow.
- Selected-amount facts occupy four equal columns at ordinary text size.
  Reflow at enlarged text rather than forcing a tiny font.
- Rename applies only to the selected date by default. An initially off
  Use as default for other dates switch updates the account default explicitly;
  saved overrides on other dates take precedence and are not rewritten.
- Chart selection highlights locally without waiting for navigation or history
  refetches. Reserve measured/scaled width and height for target-line labels.

These native review decisions supersede corresponding earlier browser states.

### Review states and boundaries

There are 44 states covering main/empty/near/over-target/narrow macros, named/
numbered/custom meals, loading/refresh error, meal detail/organization/add section,
swipe/options, search/selection/loading/no matches/error/recent/favorites/saved,
search/logged/zero-calorie/invalid quantity, manual entry, rename/time/save/copy,
calendar/move-food, scanner/manual/request/denied/busy/missing/error, save error,
dark and 200%.

The barcode screen is a labeled static illustration. It never requests camera
permission or opens a live camera. The sample code `5901234123457` resolves to
illustrative milk through a cancellable local simulation; other valid-length
inputs show missing product. Product missing, camera access off and network
failure have distinct copy and usable manual-entry fallbacks.
When permission can be requested, Allow camera leads to an explicitly labeled
Android-permission simulation. When requests are blocked, Open camera settings
leads to a labeled settings-handoff simulation. Manual entry works in either case.
Neither simulation grants real permissions. Native implementation must check
`canAskAgain`, open app settings when false, and recheck permission on return.

All nutrition values, source names, barcode mappings and results are synthetic.
They are not evidence of real database coverage, API reliability, camera behavior
or nutrient accuracy. No app files, schemas, native dependencies, backend or
permissions are changed. Food data stays in memory; it is not shared with Home's
separate meal-status fixture. Energy-unit variants beyond kcal are not implemented
in this browser candidate; existing native unit preferences must be preserved later.

Review the main diary and shared quantity editor first, then meal reuse/search/
barcode flows. Native keyboard, gestures and screen-reader testing remain required
when an approved design is implemented in the app.

## 21. Sleep browser study: approved direction

Created October 16, 2026. Open **http://127.0.0.1:4317/sleep.html** on the same
local server. Approved after iterative review, including multiple daily sessions
and simulated wearable imports. This is a design study with synthetic records, not
native health sync or a change to recovery recommendations.

### Source audit and scope

The existing `app/(tabs)/sleep/index.tsx` supports duration history, a Profile
sleep target, manual duration and Health Connect sync. `SleepNightlySummary`
contains date, hours, manual/health source and recorded timestamp. It does not
contain bedtime, wake time, sleep stages or clinical quality scores. The current
`src/sleep/sleep.ts` reads multiple Health Connect SleepSession records but sums
their start/end intervals into daily totals, discarding session identity and
timings. Its raw sum does not deduplicate overlaps. Thus native import already
accepts multiple records, but does not provide the proposed session ledger.

The revised mock preserves synthetic individual sessions with known timings,
alongside explicitly labeled older daily totals whose timings are unknown. It
does not reconstruct timings from those totals, invent stages or provide quality
scores. A session belongs to its wake date; the selected summary says Total for
[date], including split nights and naps. Do not call an older record Last night.

### Hierarchy and geometry

1. Sticky Sleep toolbar, system-bar spacing and the same bottom destinations as
   other studies. Use 20 content insets and 760 maximum content width.
2. Centered selected-date control with previous/next actions. The date opens one
   Home-style Monday-first calendar. A day tap selects immediately; no second
   picker or confirmation. Future days are unavailable in this logging study.
3. Selected duration is the main editorial figure: Source Serif 42 normally,
   64 at enlarged text, with smaller interface-font h/min units. Show the record
   date, personal-target delta in minutes, source and saved timestamp. No fake
   zero when missing. A missing date says Not recorded.
4. Keep Record sleep / Add sleep session directly below the summary. Individual
   edits belong on the session, never on the daily total. The personal
   target is a preference, not an AI prescription. The Your target text itself
   is a tappable, subtly underlined accent action with a 44-high target. It opens
   a prefilled target-hours editor with Save/Cancel and validation (more than 0,
   up to 24; one decimal). No separate help icon. Saving updates the summary,
   target line and attainment calculation. Native Sleep and Profile must use the
   same `sleepSettings.targetHours` preference in both directions; no second
   screen-local target. The Profile browser candidate now shares this saved target.
5. Daily sleep shows combined duration columns for the latest 14 calendar dates. Use
   muted border-tone bars and accent only for the selected observation. A dashed
   horizontal rule marks the actual personal target. Missing records are outlined
   gaps, never zero-height measured nights. No connecting line across missing data.
6. Each chart date occupies 56 horizontally (100 at enlarged text); plots are
   144 high (200 enlarged), bars 20 wide (32 enlarged). Every column is a full
   selectable target. The latest nights are in view initially and after resizing,
   unless the user has deliberately browsed history; preserve that position.
7. Below the chart, show average daily duration and recorded-day coverage for the
   seven calendar dates ending on the selected date. Exclude missing entries
   from the average. State both target attainment and coverage without inventing
   advice: e.g. 3 of 6 recorded days met your target; 1 day has no entry.
8. Put the selected date and actual duration immediately above the chart, not
   only in the offscreen main summary. Missing nights say Not recorded there.
   Native review removes View records and its duplicate record list: chart bars
   already select the date and show its actual duration. Calendar navigation
   remains available for other dates. Preserve the graph's viewport position
   when selecting a date adds/removes session rows above it; never jump to sync.
9. Health sync is a separate lower section: current-device connection, last sync
   on this device and the relevant Sync / Connect / Review action. Saved account
   data and source timestamps stay visible independently of that device state.

### Entry, sync and failure states

- New manual entries default to Sleep / wake times: a notebook-styled 24-hour
  circular dial with midnight at top, draggable B/W handles (Bedtime/Wake time),
  an arc and calculated duration in the center. Dragging snaps to five minutes;
  precise HH:MM text fields permit individual minutes and avoid a nested native
  time popup. Keyboard arrows on either handle adjust five minutes. Field values
  and the dial update together, including when a field still has focus.
- Inputs start empty, with examples 23:00 and 07:00, not fabricated recorded times.
  Show an editable explicit date beneath each time, not Previous day / Same day
  toggles. Initially infer bedtime as the prior date for overnight sleep or the
  wake date for a same-day nap. Tapping either date opens the shared calendar;
  returning preserves time drafts and entry scroll. Once dates are chosen
  explicitly, do not silently change them when times are edited. Cancel from
  that calendar returns to the entry, not the diary. Calculate the interval, including midnight,
  validating more than 0 and no more than 24 hours. It is a user-entered interval;
  disclose that awake time is not subtracted. Do not call it measured sleep.
- Duration only remains available with a persistent hours label, example 7.5
  and h/min preview. An imported or legacy duration without times opens here;
  explain why rather than deriving a fictional bedtime/wake time. Switching from
  valid times to duration preloads the equivalent amount. Known manual times
  preload on edit. Cancel changes nothing; errors retain the draft. A new Save
  appends a session, even when its wake date already has another session. Edit
  changes the selected session by stable ID, not every entry for that date. The
  wake date determines its diary date. Never change device sync time on manual save.
- Date-specific add/edit is proposed here; the current app's manual override
  targets its latest night. Native implementation must explicitly reconcile
  manual overrides with subsequent health imports, not silently redefine that
  policy during visual work. Editing imported duration does not edit the original
  Health Connect record. Bedtime/wake time are proposed additional manual fields,
  not existing nightly-summary fields. Native calculations must use time zones
  and actual timestamps for daylight-saving transitions, not copy the mock's
  simplified wall-clock arithmetic. Keyboard and dial gestures need device tests.
- A sync confirmation names the destination demo account before import. The
  mock explicitly labels its simulation. A successful check with no new records
  changes only last-check time and feedback, not recorded data/source/time.
- Disconnected, revoked Sleep permission and unavailable-provider states retain
  saved account history and offer manual entry. Their access actions preview the
  Profile Health sync destination; no permission is actually requested or granted.
- A missing/outdated provider offers Set up Health Connect with install/update,
  source-app sleep sharing and Lastrep consent/permission steps. Unsupported
  devices instead retain manual logging without an installation promise. Native
  action routing must use availability and Android version: built-in system
  Health Connect and standalone providers are not identical. See the official
  [availability guidance](https://developer.android.com/health-and-fitness/health-connect/availability).
  In the browser, setup remains an explicitly labeled simulation.
- Loading uses neutral placeholders. Refresh failure retains saved data and Retry.
  Offline explicitly retains history and disables sync; a manual save attempt
  keeps its draft and asks for reconnection in this mock. This is not evidence
  of the production app's offline-write behavior.
- Older data explicitly names its date. Above-target duration is not proof of
  good recovery; below-target duration alone does not prescribe training changes.

### Multiple sessions and wearable records

- Sleep entries sits between the summary and chart. Each entry shows start/end
  dates/times when known, duration and its actual source. A split night from
  23:00–03:00 and 04:00–07:00 is two entries totaling 7 hours; 03:00–04:00 does
  not count. A 13:00–14:30 nap adds 1.5 hours, making the day's total 8.5 hours.
- An old daily total is labeled Older daily total / times unavailable. It is
  not counted as a reconstructed session. Adding a timed entry to an unknown-time
  total requires review rather than blindly summing unverifiable amounts.
- New overlapping manual sessions open a review sheet before any mutation. Show
  the conflicting entries, preserve the draft and offer Replace listed entries
  or Back to edit. Replacing excludes only those entries; unrelated sessions
  remain. Touching endpoints are not overlaps. Do not silently replace an entire day.
- Manual sessions can be edited or deleted individually. Imported entries offer
  Correct in Lastrep and Exclude from totals; neither writes to Health Connect.
  A correction preserves the original as excluded and creates a manual entry
  referencing it. Re-import must not restore excluded/overridden records.
  Excluded entries remain inspectable; restoration checks conflicts first.
- The simulated import retains each provider record using origin + provider ID.
  Repeated sync updates existing sessions rather than adding copies. When actual
  provider sessions replace a legacy imported total for that day, exclude the
  legacy total from calculations; never add both representations together.
- The mock uses the union of known intervals to prevent overlap double-counting,
  including overlaps across wake dates. Manual corrections and the fixture's
  primary source take attribution priority. Other source records remain visible,
  with a review notice and the amount actually contributing in session details.
  This union is not proof that every minute was asleep: imported session windows
  may include awake time. Unknown manual durations cannot be interval-deduplicated;
  a same-day timed import is retained for review, not added blindly.
- Sync confirmation includes a labeled split-session import simulation. Repeating
  it must preserve both provider session identities, daily totals, exclusions
  and manual corrections. It is not a real wearable integration test.

### Native implementation follow-up

This design requires a session-level account store and derived daily summaries,
not just a changed chart. Preserve the existing nightly-summary contract for
Home/readiness/recommendations while deriving it from the new session ledger.
Migrate old totals as explicit legacy records without fabricated timestamps.
Persist manual corrections and exclusions so another sync/device cannot undo them.

The Health Connect adapter must preserve record IDs, data origin, start/end
timestamps, offsets/timezone, last-modified/version metadata and available sleep
stages. Read every page and reconcile updates and deletions with the provider's
change stream; an absent record in a partial response is not a deletion. Respect
current account consent and device permissions before every import.

Resolve cross-source duplication with an explicit source-priority policy aligned
with Health Connect's deduplicated aggregation where applicable. Reconcile manual
entries/overrides separately; do not simply sum raw records. Where validated stage
information exists, distinguish sleep time from awake/in-bed time. Missing stage
information must remain labeled as session duration, not a measured asleep claim.
Handle timezone travel, DST, overnight date allocation, provider source changes,
legacy conflicts and account deletion in migration and regression tests.

Health Connect represents sleep as individual sessions with start/end and optional
stages; multiple sessions can be read when the wearable's companion app writes
them. This is not a guarantee for every wearable. See the official
[sleep experience documentation](https://developer.android.com/health-and-fitness/health-connect/experiences/sleep).
Actual backend migration, permission/data safety review and device tests remain
outside this browser-only batch. The mock does not implement provider pagination,
change-token/deletion reconciliation, stage-aware aggregation or timezone/DST.

### Native Sleep candidate (October 17)

- Calendar weekday headers and date cells share explicit equal column widths;
  do not let intrinsic one-/two-digit text widths determine column geometry.
- The selected-date control already identifies the summary date; omit a second
  Total for [date] label. Add sleep session is aligned to the content's left edge.
- Do not show a View excluded entries action or an excluded-entry list on Sleep.
  Hide superseded imported daily totals and excluded/provider-deleted sessions.
  Preserve unmatched history: one same-date session does not prove a complete
  replacement. Keep internal exclusion markers without presenting obsolete totals.
  Label the daily total and selected graph value Time asleep when all counted
  time has complete stages; otherwise show May include awake time.
- History-chart selection is independent of the date being logged: bar taps
  update the graph date, duration and weekly statistics only. Use the date/calendar
  control to change the summary and session list; this resets graph selection.
  Do not change above-chart content or scroll back programmatically on bar taps.
- The native candidate implements a session ledger in owner-only
  `users/{uid}/sleepSessions`, with atomic derived summaries for existing Home,
  Profile and decision consumers. Do not rewrite legacy totals as timed sessions.
  Preserve totals without a diary date as undated legacy entries requiring the
  user to assign a date, rather than assuming their save date is their sleep date.
- Stage-derived asleep duration and session-window duration are different values.
  Only a complete, non-overlapping, known stage sequence can justify an asleep
  duration. Partial/missing stages retain the session-duration label. A secondary
  source must not fill time explicitly marked awake by the preferred source.
- Manual Delete permanently removes the entry and updates summaries atomically;
  confirmation states that deletion cannot be undone. Imported Exclude from totals
  hides the session but retains its stable identity internally to prevent re-import.
  Deleting a manual correction must not revive its excluded provider original.
  Do not offer restoration on the ordinary Sleep screen. No action writes changes to
  Health Connect. Reject removal if the entry changed since it was reviewed.
  Confirmed overlap replacement must reject entries changed since review.
- Timed entry uses actual local timestamps and persisted timezone/offset metadata,
  not the browser's UTC fixture arithmetic. Nonexistent local DST times are
  rejected. Ambiguous repeated times direct the user to duration-only entry.
- The installed Health Connect adapter omits provider timezone offsets. Preserve
  raw instants and known metadata; disclose local-time display when offsets are
  unavailable. Preserve the existing diary allocation on re-import instead of
  silently moving records when the user travels.
- All entry, target, calendar, sync, detail, exclusion and setup popups use the
  shared notebook shell, outside/Android Back dismissal, tab clearance and
  keyboard-safe body/footer layout. Inputs select existing text on focus.
- Target edits share `sleepSettings.targetHours` with Profile and update both
  screens live without reload. Reconcile external changes into saved baselines
  to avoid false unsaved-change prompts; preserve any unsaved field edits.
  Sync status and
  last-check time describe this device, not another device signed into the same
  account. A successful empty check is not a new measurement; manual edits never
  update health-sync time. Existing saved account records remain visible offline
  and when device consent/permissions are absent.
- The candidate uses the existing account's sleep-origin preference first,
  manual corrections ahead of providers, and stable origin/ID ordering as a
  fallback. Overlapping provider records remain visible with review/contribution
  information. This is not claimed to reproduce Health Connect's system-wide
  provider-priority aggregate.
- Browser approval is not native write-flow approval. See the migration checkpoint
  for completed emulator checks, read-only phone checks and remaining user tests.

### Review coverage and boundaries

33 selectable states cover overview, empty, disconnected with/without records,
permission removed, unavailable, stale, sparse, manual source, new/edit/invalid/
failed save, sync confirmation/progress/no new data/failure, loading/refresh
failure/offline, calendar, paginated record list, setup guide, unsupported device,
split night, night plus nap, wearable split, provider overlap, manual overlap,
session details, exclusion, dark paper and 200% text. Descriptive notes appear below the state selector, never
as dropdown group labels or selectable states.

The Sleep study links to the other studies but uses its own in-memory session
fixture. Its target and simulated connection state share selected Profile
preferences; sleep records do not. There is no real health access, network save,
actual account identity or recommendation calculation. Refresh/reset discards
changes. Keep this limitation explicit; do not interpret simulation checks as
production consent, health-provider, device keyboard or accessibility validation.

## 22. Profile and Settings browser studies: approved direction

These approved browser baselines extend the notebook vocabulary.
Profile is a personal-preference ledger. Settings contains account
operations, support, legal and billing. Do not move daily workout guidance here.
Use the existing paper/ink tokens, bundled fonts, ruled sections, sticky headers,
22-pixel header/tab icons and 24-pixel row-icon alignment slots with a 12-pixel
text gap. Account, Support and Legal text must start on the same vertical line.
Reflow at 200% rather than reducing type or shrinking controls.

### Profile hierarchy and editing contract

1. Header: Back to Home, Profile, Save. Save is disabled when clean or loading.
2. Identity: photo/initial, nickname, access badge, then description. The native
   badge reflects real entitlement; loading displays Checking access.
   Edit opens a focused sheet. Photo selection is nested within identity editing.
   Cancel restores the previously staged identity, including its photo.
3. Training: training phase, diet phase and days available per week. Do not add
   a second generic Goal selector: phases convey the current training/diet intent
   for this experienced-lifter audience without competing preference fields.
   Changing a phase stages Week 1; its start/history changes only on Save.
   Selecting the saved phase again must not restart its week count.
   Keep the complete phase/week value visible: one line when it fits, wrapping
   on narrow screens and stacked at enlarged text without shrinking type.
   In phase editors, the week and save/start explanation are separate paragraphs.
4. Units: weight, height, food energy and one global RPE/RIR preference. Effort is
   stored canonically as RPE in the Workout fixture; display conversion is not
   a rewrite of exercise history. Body masses remain canonical kg.
5. Body composition: tap any of the four metric labels or values to open the
   grouped editor, focused on that metric. Weight, body fat, lean body mass and
   skeletal muscle are all editable; no redundant Add/edit section action.
   Align label, input and unit. Missing values are Not recorded, never zero.
   Lean body mass and skeletal muscle have separate adjacent help buttons;
   tapping the value edits it, not its definition. Preserve the underlying page
   scroll position on opening, accepting or cancelling any sheet. Do not return
   to the top of the screen after an edit unless navigation explicitly requires it.
   On first focus, select an existing numeric value for replacement, with the
   selection's active end at the right. Empty fields start at position zero.
   Do not repeatedly select while typing or prevent a later tap from placing the
   caret. Apply this numeric-entry behavior across the browser studies. Keep
   the shared circled information icon centered in its own help target.
   Scroll focused fields into view and re-check after viewport/keyboard changes;
   the browser prototype's visual-viewport handling is not proof of native IME
   avoidance. Native implementation requires phone checks in both orientations.
   This study's snapshot is independent of Home's measurement-history fixture.
6. TDEE calculator: current estimate and Calculate. Preserve the current app's
   equation, activity factors and validation, not a new recommendation model.
   Use canonical cm/kg, age 13-100 and height 100-250 cm. Applying sets Maintain
   to the rounded estimate, Cut to estimate minus 400 kcal and Bulk to estimate
   plus 300 kcal; it preserves the protein target. Incomplete inputs disable Apply.
   Applying stages nutrition targets; the top-level Save still commits them.
   Confirm application inside the open calculator immediately, including a visible
   action-label change when a longer summary would be below the viewport. State
   that targets are drafts and require Done, then Save on Profile.
7. Nutrition targets: separate calories for each diet phase, plus protein. Tapping
   any target opens the complete group, titled Nutrition targets. Units uses the
   same grouped-editor convention, titled Units and effort; related preferences
   can be reviewed together rather than navigating four separate sheets.
   Meal labels are renamed directly in Nutrition, including Meals 1-6 if desired.
8. Sleep target: the same saved preference as Sleep. Validate greater than zero,
   no more than 24 hours, and round to the native preference's decimal precision.
9. Health sync: the explicit connection/data-state model below.

Each focused sheet uses Done/Cancel. Done accepts the staged section; it does not
silently save the whole Profile. Leaving with edits offers Save and leave,
Discard and leave, or Keep editing, stacked with readable full-width labels.
Failed/offline saves retain edits and do not mutate the saved baseline. Inline
validation explains the field problem. The browser's own tab-close/navigation
controls are not a substitute for testing native unsaved-change guards.
Profile has one contextual offline notice, driven by connectivity rather than
persisted as a save result. Blocked Save must not duplicate that notice; it clears
on reconnection without clearing the draft. Keep the shared dismissible bottom
offline banner on Profile as on other screens; it has a separate app-wide role.
An unavailable initial profile is not a generic new account: explain that saved
details have not loaded and keep Save disabled. Retry when connectivity/server
data becomes available, while preserving drafts for an already-loaded profile.

### Health state and disclosure

Keep app consent, device permissions, saved-account timestamps and last-sync
timestamps independent. Supported data describes capability, not access.
Disconnected/revoked access must not hide previously saved records or fabricate
new sync timestamps. Sleep permission can be ready while body access is absent;
the partial-body fixture explains that lean mass is missing.
Sync now stays on Profile when permissions are missing and explains how to
restore access. It must not automatically open permission/settings screens.
Permission navigation requires an explicit permissions or Connect/Reconnect action.
That action requests only missing supported reads, including partial grants.
Cancel/denial returns to Lastrep; reviewing settings is a separate fallback action.
Keep the main instruction short. A visible `Connect another health app` help link
explains enabling sharing in Samsung Health or InBody where supported, allowing
that app to write data to Health Connect, then allowing Lastrep to read it and
tapping Sync now. Do not promise historical backfill or universal app support.
Health sync help and errors must use user-facing guidance, never developer mode,
package registration or signing-certificate instructions.
An unchanged sleep import says `No new sleep data found.`; do not imply existing
saved sleep records are absent.

Connect opens the optional-health disclosure, then a separately labeled simulated
permission sheet. Cancel must not connect. Managing permissions alone does not
accept app consent. Disconnect in Lastrep stops mock reads, keeps saved records
and explains that revoking device permissions is a separate action. No confusing
three-way 'cannot disconnect / disconnect only' copy. Unavailable devices get
setup guidance and manual-entry alternatives, never developer/package/SHA steps.
AI context disclosure remains separate from granting health access.

### Settings hierarchy and outcomes

Order: Account, Appearance, Support, Legal, Subscription, Session, Delete account.
Appearance offers Light, Dark and System, with System as the default. Save the
choice separately for each account on this device and restore it after restart.
A newly encountered account starts at System. The old installation-wide value
has no account owner and must not be inherited. The signed-out state has its own
local preference. Account changes must ignore late reads/writes from a prior account. Explicit Light/Dark overrides
the OS appearance; System follows subsequent OS changes. Use the same resolved
theme across all notebook screens, tabs, navigation, loading states and dialogs.
Changing appearance updates the existing screen in place, preserving navigation,
scroll and unsaved drafts. Avoid rerendering inactive tab contents during the
change; they must display the current palette when revisited. At enlarged text, stack the three choices rather than
shrinking labels or targets. Announce storage failures and retain the last saved
choice; a failed read must not block access to the app.
Back always returns to Home. Account shows the nickname and a compact Premium or
Free badge, not a redundant Edit action. Keep badges neutral paper/ink with a
fine outline: they identify account access, not an action or warning. While access is loading, show Checking
access, not a transient Free badge. Subscription contains status detail and actions,
not a second heading-sized Premium access active/Free access label. Support shows
App version beneath Report a problem, aligned with its text; there is no separate
About section. Give App version an outlined information icon in the same 24-pixel
slot as Report a problem: 20-pixel glyph, 1.5-unit stroke, circular outline and a
clearly visible filled dot above a shorter stem. The browser SVG uses a 1.1-unit
dot radius, with no stroke on the dot. Keep the version right-aligned and the row
non-interactive; do not add a chevron or button affordance.
The native implementation must use the installed version/build,
not the browser fixture. Support uses lastrep.dev@gmail.com and includes the app
version in the report draft. Omit redundant instructions about where to find the
version from that draft. Privacy opens the published policy only after an explicit
link click. Sign out and deletion require confirmation. Deletion explains that
Google Play subscriptions must be cancelled separately. Browser simulations must
never imply that a real account was signed out or deleted.

Use metadata from the installed native binary, not the current Metro/OTA
configuration, for App version. Preserve development flavor suffixes and show
the build alongside the version. If native metadata is unavailable, say so;
never substitute a prototype version. At enlarged text, the version may reflow
below its label within the same aligned text column.

Settings account details update with saved Profile changes. An unloaded account
must not appear as a generic account or briefly show Free access. Retain saved
details through a connection loss and distinguish unavailable data from empty
values. Keep one contextual connectivity notice and the shared dismissible bottom
banner, as on Profile. Disable store/account operations while offline or busy;
failure feedback clears progress, retains the account and offers an honest retry.
Sign out and deletion use stacked confirmation actions with explicit safe choices
(Stay signed in / Keep account). Do not perform an action for a different account
if authentication changes while its confirmation is open. Support opens a draft
only on a tap and never sends account information or logs automatically.

Separate Premium entitlement from a paid subscription, including manually granted
Premium. Development builds explain billing is unavailable; no purchase/restore
SDK calls are simulated as real. Do not invent prices in a design fixture.
Restore disables duplicate requests while checking and uses native-source copy:

- Checking: "Checking purchases..."
- Restored: "Purchases restored. Premium is active."
- No active subscription: "No active subscription found. Make sure you're using
  the Google Play account you subscribed with."
- Not confirmed: "An active subscription was found, but Lastrep hasn't confirmed
  Premium access yet. Please try again shortly."
- Failure: "Couldn't restore purchases. Check your connection and try again."

No-subscription must not revoke a manual grant. The unconfirmed result must not
claim that a background verification is still running.

### Review coverage and simulation boundaries

Profile has 29 selectable states; Settings has 20. Review default, focused
editors, unsaved/invalid/error/offline/loading, consent/partial/revoked/unavailable,
all restore outcomes, free/manual Premium/dev billing, destructive confirmations,
dark paper and 200% text. State descriptions sit below the selector, never mixed
with selectable states. Preserve original dropdown order and scroll to selection.

Saved demo preferences use sessionStorage in the same browser tab: identity/avatar,
phases/history, Nutrition-managed meal labels, sleep target, effort/weight defaults and simulated
health connection. Profile changes are shared only after Save; Home phase and
Sleep target saves update the same preferences. Reset in Profile/Settings clears
this demo preference store. Explicit review states remain deterministic fixtures.
Nutrition records/targets, Home body history, Workout drafts and Sleep sessions
remain independent examples, not a unified app store. Photo uses an illustration,
not a file picker or upload. There are no Firebase, health, billing, account,
camera or deletion API calls. The public policy/mail links are explicit exceptions
to offline browsing. Native keyboard, accessibility and actual provider/billing
behavior still require separate implementation and device verification.

### Shared root-screen header revision

Workout, Nutrition, Sleep and Profile have a left Back to Home action and a
geometrically centered page title. Use equal left/right header slots, not a
space-between layout where a wider Finish/Save button shifts the title. Workout
retains Finish at the right. In enlarged text, move a wide action to a second row
rather than crowding the title or shrinking type. Nutrition subpages retain their
existing parent-screen back behavior; the root Nutrition back action goes Home.
Home keeps its brand/utility header. All header icons use the same 22-pixel glyph
inside a 44-pixel compact target. These revisions supersede earlier root headers
in the approved browser references without changing native navigation yet.


## 23. Authentication and onboarding browser studies

Sign in / Sign up received user design approval on October 19. The revised
onboarding flow received user approval on October 19. Final refinements retain
separate production/dev logos and remove visible slider minus/plus controls.
The shared browser sidebar revision is also user-approved.
Native Sign in / Sign up is merged in PR #40; the separate four-step onboarding
migration is now in progress. Both studies use the shared paper/dark
tokens, bundled serif/sans fonts, ink primary actions, explicit field labels,
restrained rules and 48px controls. Use sentence case: Sign in, Sign up and
Sign out, including confirmation and progress copy.

Authentication preserves email/password and Continue with Google. Password
visibility is included in the approved study. Do not add providers or password
reset services without separate behavior review.

The revised onboarding order is Experience, Availability, Nickname and Optional
health sync. Remove the legacy goal question; the user explicitly chose to manage
training/diet phases in Profile. Do not replace the question with mandatory phase
selection. The sample-program page is removed because preferences, equipment and
exercise suitability have not been collected. Do not present an arbitrary routine
as a personalized recommendation or generate a program during onboarding.

Use the same Lastrep wordmark as Home at the upper left: blue-purple in
production and orange-red in dev. The browser study shows production branding.
Below it,
place Back on the left and Skip on the right on one row. Skip advances a step;
on the final screen it goes Home. Keep header and content in one scrollable
surface so short landscape and 200% text do not trap controls offscreen.

Availability uses a labeled, discrete 1-7 slider (default 4), a visible day count,
and numbered ticks. Do not add visible minus/plus buttons. Keyboard arrows
change one day; native implementation must retain screen-reader adjustment and
verify it on the phone. Back preserves selections.
Nickname is explicitly optional; Continue
stays available when empty, and the name can be changed later in Profile.

Optional health sync is the final step with Go to Home as the primary action.
Explain supported records, account storage, optional connection in Profile,
revocation and the separate AI disclosure. Setup does not request permissions
or connect health data. The removed Keep your place selector was a save-failure
example, not a product step. Future native save errors belong inline on the
relevant step and retain the actual entered fields.

Phase-week follow-up: Profile currently calculates weeks from stored start dates;
it does not offer date correction. Prefer editing the start date and calculating
the week, rather than storing a second editable week count. This remains a
separate design/implementation follow-up explicitly postponed by the user; do
not implement it in this migration. The onboarding revision changes no
phase history or existing dates. Native progress storage is described below.

Keep form fields and actions scrollable on short screens and at 200% text; do
not pin a footer over fields. No tab navigation appears before entry to the app.
Browser interaction checks do not establish native keyboard/screen-reader support.


### Browser study navigation

All eight browser studies share one navigation order: Home, Workout, Nutrition,
Sleep, Profile, Settings, Sign in / Sign up and Onboarding. Omit the current
screen. Use Review followed by the screen name, with no prototype suffix.
Group all screen links in the Screen studies navigation above review controls;
Scope and review guide remains below. New study links must be updated across
all study pages, not appended below the controls on older pages.

### Migration boundaries after design approval

Recommended next boundary: complete the Settings release separately before
native authentication/onboarding migration. Release actions still require the
user's explicit instruction. Browser approval is design approval; it does not verify account
creation, provider navigation, native slider accessibility or onboarding saves.
Preserve existing accounts and records during the later migration. Removing the
onboarding goal question does not authorize deleting existing account goal data.
Phase start-date correction remains explicitly postponed.


### Android sign-in transition

Content such as the logo/text must remain below status icons throughout entry
transitions. Edge-to-edge backgrounds may extend behind the system bar. Home
uses useSafeAreaInsets padding on its outer View to avoid a native SafeAreaView
recalculating during navigation animation. Do not hard-code status-bar heights
or add root padding that doubles existing screen insets. Verify the actual
sign-in transition on the phone; a settled screenshot is insufficient.


### Native authentication implementation rules

Use the existing flavor-aware logo. Keep the entire form scrollable, apply safe
insets from the first layout, and reveal focused fields minimally after keyboard
and rotation changes. Use eye/eye-off icons in a 48dp target inside the password field at its right edge,
with reserved text padding and the same full width as the email field, retaining
Show password / Hide password accessibility labels at all text sizes.
Set email/password autofill roles and appropriate keyboard actions. A single
pending guard covers both providers and remains held through session completion.
Inline errors preserve fields and avoid raw provider diagnostics. Handle explicit
Google cancellation before requesting any cached Google tokens. Clear the SDK's
previous Google account selection before each explicit Google attempt so signing
out does not lead to automatic reuse of that account. Auth screens
have notebook dialogs/status icons but no reserved bottom-tab space. Preserve
existing account creation/storage/routing until onboarding is migrated separately.


### Native onboarding progress and failure behavior

Use explicit account-scoped progress and completion, independent of optional
nickname/experience answers and the old installation-wide completion flag. New
accounts start at Experience; accounts without a new progress marker retain
legacy access. Skips advance without writing unchosen answers. Final Skip and
Go to Home share confirmed completion behavior. Preserve draft answers on Back
and failed saves; show inline retry feedback on the actual step. Keep pending
writes locked and prevent an account change from applying stale UI results.
Do not assign a goal, phase, phase start date or generated routine during setup.
Old goal/preview links may redirect into the new flow for compatibility.
