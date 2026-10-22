import { useCallback, useEffect, useRef } from "react";
import { Keyboard, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { focusedInputScrollOffset } from "./keyboardViewport";

/** Explicit focus ownership leaves native set editors in charge of their inputs. */
export function useInputVisibility() {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const ownedInput = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const frame = useRef<number | null>(null);
  const { width, height } = useWindowDimensions();
  const reveal = useCallback(() => {
    const input = ownedInput.current;
    const scroll = scrollRef.current;
    if (!input || input !== TextInput.State.currentlyFocusedInput() || !scroll) return;
    scroll.getNativeScrollRef()?.measureInWindow((_x, top, _width, viewportHeight) => {
      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (input !== TextInput.State.currentlyFocusedInput() || scroll !== scrollRef.current || inputHeight <= 0 || viewportHeight <= 0) return;
        const keyboardTop = Keyboard.metrics()?.screenY;
        const visibleHeight = keyboardTop == null ? viewportHeight : Math.min(viewportHeight, Math.max(0, keyboardTop - top));
        if (visibleHeight <= 0) return;
        const next = focusedInputScrollOffset(offset.current, top, visibleHeight, inputTop, inputHeight);
        if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: false });
      });
    });
  }, []);
  const schedule = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => { frame.current = null; reveal(); });
    });
  }, [reveal]);
  const onInputFocus = useCallback(() => {
    ownedInput.current = TextInput.State.currentlyFocusedInput();
    schedule();
  }, [schedule]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", schedule);
    const change = Keyboard.addListener("keyboardDidChangeFrame", schedule);
    return () => { show.remove(); change.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [schedule]);
  useEffect(schedule, [width, height, schedule]);
  return { scrollRef, onInputFocus, onLayout: schedule, onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => { offset.current = event.nativeEvent.contentOffset.y; } };
}
