import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { NotebookProvider } from "../src/ui/notebook/Notebook";
import { NotebookAppDialog } from "../src/ui/notebook/NotebookAppDialog";
import { notebookDialogTabHeight, usesNotebookDesign } from "../src/ui/notebook/navigationGeometry";
import { registerAppDialogPresenter, type AppDialogButton, type AppDialogOptions } from "../src/ui/appDialog";

const DEFAULT_BUTTONS: AppDialogButton[] = [{ text: "OK", role: "default" }];

export default function AppDialogHost() {
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    registerAppDialogPresenter((options) => {
      setDialog(options);
    });
    return () => {
      registerAppDialogPresenter(null);
    };
  }, []);

  if (!dialog) return null;

  if (usesNotebookDesign(pathname)) return <BottomTabBarHeightContext.Provider value={notebookDialogTabHeight(pathname, insets.bottom, fontScale)}>
    <NotebookProvider><NotebookAppDialog dialog={dialog} onClose={() => setDialog(null)} /></NotebookProvider>
  </BottomTabBarHeightContext.Provider>;

  const buttons = dialog.buttons?.length ? dialog.buttons : DEFAULT_BUTTONS;
  const isVerticalLayout = dialog.buttonLayout === "vertical";

  return (
    <Modal transparent animationType="fade" visible={Boolean(dialog)} onRequestClose={() => setDialog(null)}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10 }}>
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={[styles.buttonRow, isVerticalLayout && styles.buttonColumn]}>
            {buttons.map((button, index) => {
              const role = button.role ?? "default";
              const isDestructive = role === "destructive";
              const isCancel = role === "cancel";
              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  style={[
                    styles.button,
                    isVerticalLayout && styles.buttonVertical,
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
          </ScrollView>
        </View>
      </SafeAreaView>
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
    maxHeight: "90%",
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
  buttonColumn: {
    flexDirection: "column",
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
  buttonVertical: {
    flex: 0,
    width: "100%",
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
