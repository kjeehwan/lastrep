import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { ProfileSheet } from "../../profile/ProfileNotebookControls";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { ExerciseTargetsSheet } from "./ExerciseTargetsSheet";
import { exerciseTargetsText, effectiveGroupTargets, type ExerciseTargets, type GroupTargets } from "../exerciseTargets";
import type { EffortScale } from "../effortScale";

type TargetValues = { targets?: ExerciseTargets | null; groupTargets?: GroupTargets | null };
/** Reuses the existing staged editor; only Done commits a group override. */
export function GroupedTargetsSheet({ name, sets, targets, groupTargets, effortScale, onClose, onApply }: TargetValues & {
  name: string; sets: { setType?: string }[]; effortScale: EffortScale;
  onClose: () => void; onApply: (values: TargetValues) => void;
}) {
  const { colors } = useNotebook();
  const [editing,setEditing] = useState<"default" | "top" | "backoff" | null>(null);
  const roles = (["top","backoff"] as const).filter(role => sets.some(set => set.setType === role));
  const grouped = roles.length > 0;
  const label = (role: "default" | "top" | "backoff") => role === "default" ? "Exercise defaults" : role === "top" ? "Top" : "Back-off";
  if (!grouped || editing) {
    const role = editing ?? "default";
    return <ExerciseTargetsSheet key={role} name={grouped ? `${name} · ${label(role)}` : name}
      targets={role === "default" ? targets : groupTargets?.[role]}
      effortScale={effortScale} clearLabel={role === "default" ? undefined : "Use exercise targets"}
      helpText="Exercise defaults apply to Normal, Top and Back-off. A group override replaces those defaults for that role. Clearing an override returns to exercise defaults. Recorded reps and effort stay separate."
      onClose={() => grouped ? setEditing(null) : onClose()}
      onApply={value => { onApply(role === "default" ? {targets:value,groupTargets} : {targets,groupTargets:{...groupTargets,[role]:value}}); if (grouped) setEditing(null); else onClose(); }} />;
  }
  return <ProfileSheet title="Targets" onClose={onClose}>
    <Text style={{color:colors.ink,fontFamily:notebookFonts.semibold,fontSize:20}}>{name}</Text>
    <Text style={{color:colors.muted,fontFamily:notebookFonts.body,fontSize:14}}>Set exercise defaults, then override a group only when needed.</Text>
    <View>{(["default",...roles] as const).map(role => <Pressable key={role} accessibilityRole="button" onPress={() => setEditing(role)} style={{minHeight:64,paddingVertical:12,flexDirection:"row",alignItems:"center",gap:12,borderBottomWidth:role===roles.at(-1)?0:1,borderBottomColor:colors.rule}}>
      <View style={{flex:1,gap:4}}><Text style={{color:colors.ink,fontFamily:notebookFonts.body,fontSize:16}}>{label(role)}</Text>
        <Text style={{color:colors.muted,fontFamily:notebookFonts.body,fontSize:12}}>{exerciseTargetsText(role === "default" ? targets : effectiveGroupTargets({targets,groupTargets},role),effortScale) || "Not set"}{role !== "default" && !groupTargets?.[role] ? " · Uses exercise targets" : ""}</Text>
      </View><ChevronRight size={18} strokeWidth={1.5} color={colors.muted}/>
    </Pressable>)}</View>
  </ProfileSheet>;
}
