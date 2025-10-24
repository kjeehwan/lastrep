import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext"; // ✅ useTheme instead of Colors

export default function WorkoutsScreen() {
  const { theme } = useTheme(); // ✅ get current theme

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        Workouts screen coming soon 💪
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18 },
});
