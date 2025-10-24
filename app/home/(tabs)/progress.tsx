import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext"; // ✅ theme hook

export default function ProgressScreen() {
  const { theme } = useTheme(); // ✅ dynamic theme

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        Progress tracking coming soon 📈
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18 },
});
