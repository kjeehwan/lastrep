import { expect, it } from "vitest";
import { bindEventCallbacks } from "./eventCallbacks";

it("keeps stable event identities while using the latest state-dependent handlers", () => {
  let callbacks = { read: (id: string) => `${id}:kg`, undo: () => "first" };
  const stable = bindEventCallbacks(["read", "undo"], () => callbacks);
  const handler = stable.read;
  expect(handler("set")).toBe("set:kg");
  callbacks = { read: (id: string) => `${id}:lbs`, undo: () => "latest" };
  expect(stable.read).toBe(handler);
  expect(stable.read("set")).toBe("set:lbs");
  expect(stable.undo()).toBe("latest");
});
