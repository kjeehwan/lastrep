import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type ScrollViewProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { focusedInputScrollOffset, modalViewportHeight } from "./keyboardViewport";

/** Keeps dialog content reachable in short landscape and resized windows. */
export function AdaptiveModalCard({ children, style, contentSized = false }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentSized?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const pendingFrame = useRef<number | null>(null);
  const ownedFocus = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  const scrollFocusedInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current;
    const viewport = scroll?.getNativeScrollRef();
    if (!input || input !== ownedFocus.current || !viewport || !scroll) return;
    // Measure the settled native layout: keyboard coordinates can lag rotation.
    viewport.measureInWindow((_x, top, _width, viewportHeight) => {
      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (input !== TextInput.State.currentlyFocusedInput() || scroll !== scrollRef.current || viewportHeight <= 0 || inputHeight <= 0) return;
        const offset = focusedInputScrollOffset(scrollOffset.current, top, viewportHeight, inputTop, inputHeight);
        if (Math.abs(offset - scrollOffset.current) > 1) scroll.scrollTo({ y: offset, animated: false });
      });
    });
  }, []);
  const scheduleFocusVisibility = useCallback(() => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = null;
        scrollFocusedInput();
      });
    });
  }, [scrollFocusedInput]);
  useEffect(() => () => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => setKeyboardTop(event.endCoordinates.screenY));
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => setKeyboardTop(event.endCoordinates.screenY));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));
    return () => { show.remove(); change.remove(); hide.remove(); };
  }, []);
  const windowHeight = modalViewportHeight(height, keyboardTop, insets.top, insets.bottom);
  const requestedHeight = StyleSheet.flatten(style)?.maxHeight;
  const availableHeight = Math.min(windowHeight, contentSized && typeof requestedHeight === "number" ? requestedHeight : Infinity);
  useEffect(() => {
    scheduleFocusVisibility();
  }, [availableHeight, width, scheduleFocusVisibility]);
  const existingWidth = StyleSheet.flatten(style)?.maxWidth;
  const maxWidth = Math.min(typeof existingWidth === "number" ? existingWidth : Infinity, 560);
  const content = React.Children.map(children, (child) => {
    if (!React.isValidElement<ScrollViewProps>(child) || child.type !== ScrollView || child.props.horizontal) {
      return child;
    }
    const existingHeight = StyleSheet.flatten(child.props.style)?.maxHeight;
    // Reserve room for the title and footer instead of nesting a tall list.
    const listHeight = Math.min(
      typeof existingHeight === "number" ? existingHeight : Infinity,
      availableHeight * 0.45,
    );
    return React.cloneElement(child, {
      nestedScrollEnabled: true,
      style: [child.props.style, { maxHeight: listHeight }],
    });
  });
  const focusAware = (nodes: ReactNode): ReactNode => React.Children.map(nodes, (child) => {
    if (!React.isValidElement<{ children?: ReactNode }>(child)) return child;
    if (child.type === TextInput) {
      const input = child as React.ReactElement<TextInputProps>;
      return React.cloneElement(input, { onFocus: (event) => { input.props.onFocus?.(event); ownedFocus.current = TextInput.State.currentlyFocusedInput(); scheduleFocusVisibility(); } });
    }
    return child.props.children ? React.cloneElement(child, { children: focusAware(child.props.children) }) : child;
  });
  return (
    <View style={[style, { maxHeight: availableHeight, maxWidth, alignSelf: "center" }]}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" nestedScrollEnabled
        onLayout={scheduleFocusVisibility} onContentSizeChange={scheduleFocusVisibility}
        scrollEventThrottle={16} onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        style={{ flexShrink: 1, ...(contentSized ? { flexGrow: 0 } : {}) }}>
        {focusAware(content)}
      </ScrollView>
    </View>
  );
}
