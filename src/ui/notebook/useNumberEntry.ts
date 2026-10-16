import { useRef, type RefObject } from "react";
import type { TextInput } from "react-native";
import { createInputSelectionGate } from "./inputSelectionGate";

export function useNumberEntry(ref: RefObject<TextInput | null>) {
  const gate = useRef(createInputSelectionGate());
  return {
    reset() { gate.current.reset(); },
    changed() { gate.current.changed(); },
    selectInitial(value: string) {
      const stillCurrent = gate.current.claim();
      if (stillCurrent) requestAnimationFrame(() => {
        if (stillCurrent() && ref.current?.isFocused()) ref.current.setSelection(0, value.length);
      });
    },
  };
}
