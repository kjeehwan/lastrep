import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { ProfileAction, ProfileSheet } from "../../profile/ProfileNotebookControls";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { WorkoutChoiceChips } from "./WorkoutChoiceChips";

export function WorkoutDisplayChoiceSheet({ kind, selected, onSelect, onClose }: {
  kind: "weight" | "distance" | "effort"; selected: string; onSelect: (value: string) => Promise<void>; onClose: () => void;
}) {
  const { colors } = useNotebook();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const close = () => { if (!locked.current) onClose(); };
  const choose = async (value: string) => {
    if (locked.current || value === selected) return;
    locked.current = true; setPending(value); setError("");
    try { await onSelect(value); }
    catch { setError("Couldn't save your choice. Please try again."); }
    finally { locked.current = false; setPending(null); }
  };
  const text = { color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 20 };
  return <ProfileSheet title={kind === "effort" ? "Effort scale" : kind === "distance" ? "Distance unit" : "Weight unit"} onClose={close}
    footer={<ProfileAction label={pending ? "Saving..." : "Done"} onPress={close} disabled={pending !== null} />}>
    {kind === "effort" && <View style={{ gap: 12 }}>
      <Text style={text}>{"RPE 6\u201310 rates effort. 10 means no reps left."}</Text>
      <Text style={text}>{"RIR 0\u20134 counts reps left. 0 means no reps left."}</Text>
    </View>}
    <WorkoutChoiceChips values={kind === "weight" ? ["kg", "lbs"] : kind === "distance" ? ["km", "mi"] : ["RPE", "RIR"]} selected={pending ?? selected} onChange={value => { void choose(value); }} disabled={pending !== null} />
    <Text style={text}>{kind === "effort" ? "Applies across Lastrep." : "Applies to this exercise."}</Text>
    {!!error && <Text accessibilityRole="alert" style={[text, { color: colors.danger }]}>{error}</Text>}
  </ProfileSheet>;
}
