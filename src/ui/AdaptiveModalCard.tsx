import React, { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Keeps dialog content reachable in short landscape and resized windows. */
export function AdaptiveModalCard({ children, style }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(120, height - insets.top - insets.bottom - 32);
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
  return (
    <View style={[style, { maxHeight: availableHeight, maxWidth, alignSelf: "center" }]}>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ flexShrink: 1 }}>
        {content}
      </ScrollView>
    </View>
  );
}
