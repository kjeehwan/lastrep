/** Settings is a hidden tab, not a stack screen to dismiss. */
export function returnFromSettingsToHome(navigation: { navigate: (name: "home") => void }): void {
  navigation.navigate("home");
}
