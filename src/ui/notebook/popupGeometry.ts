export function popupBottomSpace(bottomInset: number, tabBarHeight: number | undefined, keyboardVisible: boolean) {
  return keyboardVisible ? bottomInset : Math.max(bottomInset, tabBarHeight ?? 0) + 12;
}
