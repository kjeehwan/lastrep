import { afterEach, expect, it, vi } from "vitest";
import { confirmAppDialog, registerAppDialogPresenter, type AppDialogOptions } from "./appDialog";

afterEach(() => registerAppDialogPresenter(null));

it.each(["confirm", "cancel", "dismiss"])("resolves confirmation on %s", async (action) => {
  let dialog!: AppDialogOptions;
  registerAppDialogPresenter((options) => { dialog = options; });
  const resolved = vi.fn();
  const result = confirmAppDialog("Title", "Instructions", "Open");
  void result.then(resolved);
  await Promise.resolve();
  expect(resolved).not.toHaveBeenCalled();
  if (action === "dismiss") dialog.onDismiss?.();
  else dialog.buttons?.find((button) => button.text === (action === "confirm" ? "Open" : "Cancel"))?.onPress?.();
  expect(await result).toBe(action === "confirm");
});

it("does not leave a confirmation pending without a presenter", async () => {
  expect(await confirmAppDialog("Title", "Instructions", "Open")).toBe(false);
});
