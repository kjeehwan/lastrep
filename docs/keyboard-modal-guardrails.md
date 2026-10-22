# Input modal keyboard guardrails

Put `KeyboardAwareModalFrame` immediately inside the native Modal. Keyboard
avoidance around a bottom-aligned card alone is not sufficient. Do not assume
the underlying page's keyboard-avoiding view controls a separate modal window.

Use `AdaptiveModalCard` for scrollable modal content. It limits height to the
keyboard-visible viewport and scrolls its own focused native input into view.
Existing input focus handlers are preserved. Direct nested input ScrollViews
should be replaced with content Views so the card owns the scrolling.

Workout's page-level exercise notes use explicit focus ownership and measured
scrolling through `useInputVisibility`. Keep Android's automatic child-focus
scrolling disabled there: native set rows retain their own visibility handling.
Measure the smaller of the scroll viewport and keyboard boundary, so an already
resized Android window does not subtract keyboard height twice. Reveal only the
focused note, without animation or resetting the user's scroll position.

Applied to body-composition data, Workout input/routine dialogs and modal shell,
program editing, nutrition serving/custom-food/saved-meal editors, barcode entry,
available weights and Today's Plan context. Existing provider reads, saved drafts
and submission behavior are unchanged.

Automated viewport tests cover no keyboard, keyboard overlay, native window
resize without double subtraction and short landscape windows. They are not a
substitute for device checks when adding a new input or changing modal layout.

On October 14, 2026 the connected Samsung SM_A516N was checked in portrait:
the lowest body-data field remained visible above the numberpad with cursor and
placeholder visible; scrolling reached Save data and Cancel above the keyboard.
No data was typed or saved, and the unsaved sheet was dismissed afterward.

Remaining device regression checks: rotate with the keyboard open, tap every
body-data field, and check routine name, tempo/time/distance, available weights,
serving/custom-food fields, barcode entry and context notes. Verify current text
survives rotation and Cancel does not save. Do not declare all keyboard layouts
verified based solely on TypeScript or a successful build.
