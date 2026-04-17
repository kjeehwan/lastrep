import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { registerAppDialogPresenter, type AppDialogOptions } from "../src/ui/appDialog";

const DEFAULT_BUTTONS = [{ text: "OK", role: "default" as const }];

export default function AppDialogHost() {
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);

  useEffect(() => {
    registerAppDialogPresenter((options) => {
      setDialog(options);
    });
    return () => {
      registerAppDialogPresenter(null);
    };
  }, []);

  if (!dialog) return null;

  const buttons = dialog.buttons?.length ? dialog.buttons : DEFAULT_BUTTONS;

  return (
    <Modal transparent animationType="fade" visible={Boolean(dialog)} onRequestClose={() => setDialog(null)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={styles.buttonRow}>
            {buttons.map((button, index) => {
              const role = button.role ?? "default";
              const isDestructive = role === "destructive";
              const isCancel = role === "cancel";
              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  style={[
                    styles.button,
                    isDestructive && styles.buttonDestructive,
                    isCancel && styles.buttonCancel,
                  ]}
                  onPress={() => {
                    setDialog(null);
                    button.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isDestructive && styles.buttonTextDestructive,
                      isCancel && styles.buttonTextCancel,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7,8,16,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#121428",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  message: {
    color: "#c5cbdd",
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(123,97,255,0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.7)",
  },
  buttonDestructive: {
    backgroundColor: "rgba(239,68,68,0.22)",
    borderColor: "rgba(239,68,68,0.75)",
  },
  buttonCancel: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  buttonText: {
    color: "#e9e7ff",
    fontWeight: "700",
  },
  buttonTextDestructive: {
    color: "#ffd4d4",
  },
  buttonTextCancel: {
    color: "#d9dceb",
  },
});
