import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { EXERCISES } from "../../data/exercises";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
};

export default function ExercisePickerModal({ visible, onClose, onSelect }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");

  const filtered = EXERCISES.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase())
  );

  // Memoized styles to optimize performance and respect theme changes
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modal: {
      width: "100%",
      maxHeight: "80%",
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 12,
      textAlign: "center",
      color: theme.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      marginBottom: 12,
      borderColor: theme.border,
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    list: { marginBottom: 12 },
    item: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    closeButton: {
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: theme.primary,
    },
    closeButtonText: {
      color: theme.buttonText,
      fontWeight: "700",
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <Text style={styles.title}>Select Exercise</Text>

          <TextInput
            placeholder="Search exercise..."
            value={query}
            onChangeText={setQuery}
            style={styles.input}
            placeholderTextColor={theme.placeholder}
          />

          <ScrollView style={styles.list}>
            {filtered.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => {
                  onSelect(name); // Add exercise once
                  setQuery("");    // Reset search field
                  onClose();       // Close modal
                }}
                style={styles.item}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.textPrimary }}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
