import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { createStyles } from "../workouts/workoutLog/workoutLogStyles";
import { notebookFonts } from "../ui/notebook/tokens";
import type { SharedProgramPlan, SharingPerson } from "./sharingContract";

export function SharingProgramPreview({plan,sender,onRoutine}:{plan:SharedProgramPlan;sender?:SharingPerson;onRoutine:(key:string)=>void}) {
  const {colors}=useNotebook(),styles=useNotebookStyles(createStyles);
  return <ScrollView style={{maxHeight:350}} keyboardShouldPersistTaps="handled">
    <View style={{gap:8,paddingBottom:16,borderBottomWidth:1,borderColor:colors.rule}}>
      <Text style={styles.sessionTitle}>{plan.title}</Text>
      {sender && <Text style={styles.muted}>From {sender.nickname}{sender.username ? ` · @${sender.username}` : ""}</Text>}
      <Text style={styles.muted}>{plan.days.length}-day cycle · {plan.days.filter(d=>d.type==="workout").length} workout days · {plan.routines.length} routines</Text>
    </View>
    {plan.days.map((day,index)=>{
      const routine=plan.routines.find(r=>r.key===day.routineKey);
      const content=<><Text style={{width:24,textAlign:"center",fontSize:16,fontFamily:day.type==="rest"?notebookFonts.semibold:notebookFonts.body,color:colors.ink}}>{index+1}</Text><View style={{flex:1,gap:8}}><Text style={{fontSize:16,fontFamily:notebookFonts.semibold,color:colors.ink}}>{day.title}</Text>{routine && <Text style={styles.muted}>{routine.plan.exercises.map(e=>e.name).join(" · ")}</Text>}</View>{routine && <ChevronRight size={18} color={colors.muted}/>}</>;
      const style={flexDirection:"row" as const,alignItems:"center" as const,gap:12,paddingVertical:16,borderBottomWidth:1,borderColor:colors.rule};
      return routine ? <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Day ${index+1}: ${day.title}`} onPress={()=>onRoutine(routine.key)} style={style}>{content}</Pressable> : <View key={index} style={style}>{content}</View>;
    })}
  </ScrollView>;
}
