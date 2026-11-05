import { useSharing } from "../sharing/SharingProvider";
import { programToSharingPlan } from "../sharing/programSharingPlan";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity as Pressable, Text, View, useWindowDimensions } from "react-native";
import { Play, Pencil, Square, RotateCcw, Share2, Trash2 } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { useNotebook, useNotebookStyles, notebookSheet } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import { WorkoutModalShell } from "./workoutLog/WorkoutModalShell";
import { showAppDialog } from "../ui/appDialog";
import type { Routine } from "./workoutLog/workoutLogModel";
import { runRef, activateStoredProgram, deleteStoredProgram, saveProgram, stopStoredProgram, updateProgramRun } from "./programStore";
import { changeProgramSchedule, currentProgramOrdinal, dateKey, emptyProgramDays, programDateLabel, programDayLink, programOccurrence, programSetupError,
  type ProgramLink, type ProgramRecord, type ProgramRun, type ProgramScheduleAction } from "./programFlow";
import type { useWorkoutPrograms } from "./useWorkoutPrograms";
import { useEventCallbacks } from "../hooks/useEventCallbacks";
import { useNow } from "../hooks/useNow";

type Programs = ReturnType<typeof useWorkoutPrograms>;
type Props = { effortScale?: "rpe" | "rir"; uid: string; data: Programs; routines: Routine[]; choices: boolean; hasDraft: boolean;
  managerRequest?: {programId?:string;action?:"library"|"create"|"start";token:number}|null;
  onManagerOpened?: () => void;
  onResume: () => void; onStandalone: () => Promise<void>;
  onRestDay: () => void;
  onWorkout: (routine: Routine, link: ProgramLink, draft?:Record<string,unknown>) => Promise<void>;
  onCreateRoutine: (program: ProgramRecord, day: number) => Promise<void> };

export function WorkoutProgramPanel(props: Props) {
  const { colors } = useNotebook();
  const sharing = useSharing();
  const [pendingSharedStart,setPendingSharedStart] = useState<string|null>(null);
  const styles = useNotebookStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const actionColumns = fontScale >= 1.5 ? 2 : 3;
  const [page, setPage] = useState<"library" | "edit" | "details" | "assign" | "schedule" | "resume" | "history" | null>(null);
  const [draft, setDraft] = useState<ProgramRecord | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ProgramRun | null>(null);
  const [previousRuns, setPreviousRuns] = useState<ProgramRun[]>([]);
  const [historyEntries,setHistoryEntries] = useState<{title:string;dateKey:string;dayNumber:number;status:string}[]>([]);
  const [historyCursor,setHistoryCursor] = useState<QueryDocumentSnapshot|null>(null);
  const [scheduleAction, setScheduleAction] = useState<ProgramScheduleAction | null>(null);
  const now = useNow(60_000);
  const execute = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) { setPage(null); setError(null); } };
  const open = (program: ProgramRecord, next: "edit" | "details") => { setDraft({ ...program, days: program.days.map(day => ({ ...day })) }); setPage(next); setError(null); };
  const { newProgram } = useEventCallbacks({ newProgram: () => open({ id: doc(collection(db, "users", props.uid, "workoutPrograms")).id, name: "", days: emptyProgramDays(), status: "draft", runId: null, updatedAt: Date.now() }, "edit") });
  const { openManager } = useEventCallbacks({openManager:()=>{
    const request=props.managerRequest;if(!request)return;
    if(request.action==="create")newProgram();
    else if(request.programId){const program=props.data.programs.find(item=>item.id===request.programId);if(!program)return;if(program.days.some(day=>day.routineId&&!props.routines.some(r=>r.id===day.routineId)))return;open(program,"details");if(request.action==="start"&&!program.runId)setPendingSharedStart(program.id);}
    else setPage("library");
    props.onManagerOpened?.();
  }});
  useEffect(()=>{
    if(!props.managerRequest||!props.data.loaded)return;
    const task=setTimeout(openManager,0);return()=>clearTimeout(task);
  },[props.managerRequest,props.data.loaded,props.data.programs,props.routines,openManager]);
  const button = (label: string, onPress: () => void, kind: "primary" | "neutral" | "danger" = "neutral") => <Pressable key={label} accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.button, kind === "primary" && styles.primary]}>
    <Text style={[styles.buttonText, kind === "primary" && { color: colors.onPrimary }, kind === "danger" && { color: colors.danger }]}>{label}</Text>
  </Pressable>;
  const row = (title: string, detail: string, onPress: () => void, primary = false, border = true, identity=title) => <Pressable key={identity} accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.row,!border && {borderBottomWidth:0,paddingVertical:16}]}>
    <View style={{ flex: 1, gap: 6 }}><Text style={[styles.rowTitle, primary && { color: colors.accent }]}>{title}</Text>{detail ? <Text style={styles.muted}>{detail}</Text> : null}</View><Ionicons name="chevron-forward" size={20} color={colors.muted} />
  </Pressable>;
  const continueProgram = async () => {
    const active = props.data.active ?? props.data.programs.find(item=>item.id===props.data.activeId);
    const run = props.data.run ?? (active?.runId ? (await getDoc(runRef(props.uid,active.id,active.runId))).data() as ProgramRun | undefined : undefined);
    if (!active || !run) throw new Error("The program schedule is still loading.");
    const ordinal = currentProgramOrdinal(active, run);
    const occurrence = programOccurrence(active, run, ordinal);
    if (occurrence.type === "rest") { setDraft(active); setSelectedRun(run); setSelectedDay(ordinal); setPage("schedule"); return; }
    const link = programDayLink(active, run, ordinal);
    const routine = props.routines.find(item => item.id === link?.routineId);
    if (!link || !routine) { open(active, "edit"); setError("Choose an existing routine for this day."); return; }
    await props.onWorkout(routine,link);
  };
  const activate = (mode: "start" | "resume" | "restart") => {
    if (!draft) return;
    void execute(async () => {
      await saveProgram(props.uid, draft);
      const {program,run}=await activateStoredProgram(props.uid, draft, mode);
      const ordinal=currentProgramOrdinal(program,run);
      const link=programDayLink(program,run,ordinal);
      if(link){
        const routine=props.routines.find(item=>item.id===link.routineId);
        if(!routine)throw new Error("The assigned routine is unavailable. Edit this program to choose another routine.");
        await props.onWorkout(routine,link);
      }else props.onRestDay();
      setPage(null);
    });
  };
  const startConfirmation = (mode: "start" | "restart") => showAppDialog({ title: mode === "restart" ? "Restart program?" : "Start program?",
    message: mode === "restart" ? "Start Day 1 today in a new run. Previous runs, routines and workouts stay saved." : "Use this program from today. Your current workout draft stays saved.",
    buttons: [{ text: "Cancel", role: "cancel" }, { text: mode === "restart" ? "Restart program" : "Start program", onPress: () => activate(mode) }] });
  const {confirmSharedStart}=useEventCallbacks({confirmSharedStart:()=>{if(pendingSharedStart && draft?.id===pendingSharedStart){setPendingSharedStart(null);startConfirmation("start");}}});
  useEffect(()=>{if(!pendingSharedStart||draft?.id!==pendingSharedStart)return;const task=setTimeout(confirmSharedStart,0);return()=>clearTimeout(task);},[pendingSharedStart,draft?.id,confirmSharedStart]);
  const showDetails = async (program: ProgramRecord) => {
    open(program, "details"); setSelectedRun(null);
    if (!program.runId) return;
    const runs = await getDocs(collection(db, "users", props.uid, "workoutPrograms", program.id, "runs"));
    setSelectedRun(runs.docs.find(item => item.id === program.runId)?.data() as ProgramRun ?? null);
    setPreviousRuns(runs.docs.filter(item => item.id !== program.runId).map(item => item.data() as ProgramRun).sort((a,b) => b.startedDateKey.localeCompare(a.startedDateKey)));
  };
  const loadRunHistory = async (run:ProgramRun,more=false) => {
    if(!draft)return;
    const records=collection(db,"users",props.uid,"workoutPrograms",draft.id,"runs",run.id,"occurrences");
    const documents=await getDocs(query(records,orderBy("ordinal","desc"),...(more&&historyCursor?[startAfter(historyCursor)]:[]),limit(50)));
    const entries=documents.docs.map(item=>item.data() as typeof historyEntries[number]);
    setHistoryEntries(previous=>more?[...previous,...entries]:entries);setHistoryCursor(documents.size===50?documents.docs[documents.docs.length-1]:null);setSelectedRun(run);
  };
  const schedule = async (action: ProgramScheduleAction, target?: number) => {
    if (!draft || !selectedRun) return;
    const ordinal = currentProgramOrdinal(draft, selectedRun);
    const next = changeProgramSchedule(draft, selectedRun, ordinal, action, target);
    await updateProgramRun(props.uid, draft, selectedRun, next);
    setSelectedRun({ ...next, revision: (selectedRun.revision ?? 0) + 1 }); setScheduleAction(null); setPage(null);
  };
  const { active, run } = props.data;
  const ordinal = active && run ? currentProgramOrdinal(active, run) : 0;
  return <>
    {props.choices ? <View>
      {props.hasDraft ? row("Resume workout", "Continue your unfinished workout", props.onResume, true) : null}
      {active ? row("Continue program", `${active.name} · Day ${ordinal % active.days.length + 1}`, () => void execute(continueProgram), !props.hasDraft) : null}
      {row("Create program", "Assign your routines to workout and rest days", newProgram)}
      {row("Start workout", "Choose a routine or build today's workout", () => void execute(props.onStandalone), !props.hasDraft && !active)}
      {row("My programs", props.data.programs.length ? `${props.data.programs.length} saved` : "Your saved programs", () => setPage("library"))}
      {!props.data.loaded && !props.data.error ? <ActivityIndicator color={colors.ink} /> : null}
      {props.data.error ? <><Text style={styles.error}>{props.data.error}</Text>{button("Try again", props.data.retry)}</> : null}
    </View> : active && run ? <View style={styles.strip}>
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Edit program title" style={styles.titleAction} onPress={() => open(active, "edit")}><Text style={[styles.rowTitle, styles.programName]}>{active.name}</Text><View style={styles.titlePencil}><Pencil size={18} strokeWidth={1.5} color={colors.muted} /></View></Pressable><Text style={styles.muted}>Week {Math.max(1, Math.floor((Date.parse(dateKey()) - Date.parse(run.startedDateKey)) / 604800000) + 1)}</Text></View>
      <View style={styles.days}>{active.days.map((_, index) => {
        const occurrenceOrdinal = Math.floor(ordinal / active.days.length) * active.days.length + index;
        const item = programOccurrence(active, run, occurrenceOrdinal);
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Day ${index + 1}, ${item.title}, ${item.status}`} style={[styles.day, occurrenceOrdinal === ordinal && styles.selected]} onPress={() => { setDraft(active); setSelectedRun(run); setSelectedDay(occurrenceOrdinal); setPage("schedule"); }}>
          <Text style={styles.buttonText}>{item.status === "completed" ? "✓" : index + 1}</Text>
        </Pressable>;
      })}</View>
    </View> : null}
    {error && !page ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <WorkoutModalShell compactLandscape androidBehavior="padding" visible={page !== null} onRequestClose={close} backdropStyle={styles.overlay} cardStyle={styles.card}>
      <View style={styles.heading}><Text style={styles.title}>{page === "library" ? "My programs" : page === "assign" ? `Routine for Day ${selectedDay + 1}` : page === "edit" ? "Program" : page === "schedule" ? "Change schedule" : page === "resume" ? "Resume program" : page === "history" ? "Previous runs" : draft?.name}</Text><Pressable accessibilityLabel="Close" hitSlop={12} onPress={close} disabled={busy}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
      {page === "library" ? <>{props.data.programs.map(program => row(program.name || "Untitled program", `${program.days.length} days${program.deleting ? " - Deletion unfinished" : program.id === props.data.activeId ? " · Active" : program.status === "draft" ? " · Draft" : ""}`, () => void execute(() => showDetails(program)),false,true,program.id))}{button("Create program", newProgram)}</> : null}
      {page === "edit" && draft ? <>
        <NotebookTextInput disableFullscreenUI accessibilityLabel="Program name" placeholder="Program name" value={draft.name} onChangeText={name => setDraft({ ...draft, name })} style={styles.input} maxLength={100} />
        <View style={styles.heading}><Text style={styles.rowTitle}>Days</Text><View style={styles.days}>{button("−", () => setDraft({ ...draft, days: draft.days.slice(0, Math.max(1, draft.days.length - 1)) }))}<Text style={styles.buttonText}>{draft.days.length}</Text>{button("+", () => setDraft({ ...draft, days: [...draft.days, ...emptyProgramDays(1)].slice(0,14) }))}</View></View>
        {draft.days.map((day, index) => row(`Day ${index + 1}`, day.title, () => { setSelectedDay(index); setPage("assign"); }))}
        {button("Save program", () => void execute(async () => { await saveProgram(props.uid, { ...draft, status: programSetupError(draft) ? "draft" : "saved" }); setPage(null); }), "primary")}
        {!draft.runId ? button("Start program", () => { const problem = programSetupError(draft); if (problem) setError(problem); else startConfirmation("start"); }) : null}
      </> : null}
      {page === "assign" && draft ? <>
        {row("Rest", "No workout planned", () => { setDraft({ ...draft, days: draft.days.map((day,index) => index === selectedDay ? { type: "rest", routineId: null, title: "Rest" } : day) }); setPage("edit"); })}
        {[...props.routines].sort((a,b) => a.name.localeCompare(b.name)).map(routine => row(routine.name, routine.exercises.map(exercise => exercise.name).join(" · "), () => { setDraft({ ...draft, days: draft.days.map((day,index) => index === selectedDay ? { type: "workout", routineId: routine.id, title: routine.name } : day) }); setPage("edit"); },false,false,routine.id))}
        <View style={{borderWidth:1,borderColor:colors.border,borderRadius:8,marginTop:16}}>{button("+ Create routine", () => void execute(async () => { await saveProgram(props.uid, draft); await props.onCreateRoutine(draft, selectedDay); setPage(null); }))}</View>
      </> : null}
      {page === "details" && draft && !draft.deleting ? <>
        {draft.days.map((day,index) => <View key={index} style={styles.detailRow}><Text style={styles.rowTitle}>Day {index + 1} · {day.title}</Text>{day.routineId ? <Text style={styles.muted}>{props.routines.find(routine => routine.id === day.routineId)?.exercises.map(exercise => exercise.name).join(" · ") ?? "Routine unavailable"}</Text> : null}</View>)}
        {(() => {
          const isActive = props.data.activeId === draft.id;
          const actions = [
            { label: isActive ? "Continue" : draft.runId ? "Resume" : "Start", Icon: Play, color: colors.ink,
              onPress: () => isActive ? void execute(async () => { setPage(null); await continueProgram(); }) : draft.runId ? setPage("resume") : startConfirmation("start") },
            { label: "Edit", Icon: Pencil, color: colors.ink, onPress: () => setPage("edit") },
            ...(isActive ? [{ label: "Stop", Icon: Square, color: colors.ink, onPress: () => void execute(() => stopStoredProgram(props.uid, draft.id)) }] : []),
            ...(draft.runId ? [{ label: "Restart", Icon: RotateCcw, color: colors.ink, onPress: () => startConfirmation("restart") }] : []),
            { label: "Share", Icon: Share2, color: colors.ink, onPress: () => { try { const plan=programToSharingPlan(draft,props.routines,props.effortScale??"rpe");setPage(null);sharing.open(plan); } catch(e) {setError(e instanceof Error ? e.message : "Could not prepare this program.");} } },
            { label: "Delete", Icon: Trash2, color: colors.danger, onPress: () => showAppDialog({ title: "Delete program?", message: "Remove this program and its schedule. Saved workouts, routines and your current draft stay saved.", buttons: [{ text: "Cancel", role: "cancel" }, { text: "Delete program", role: "destructive", onPress: () => void execute(async () => { await deleteStoredProgram(props.uid, draft.id); setPage("library"); }) }] }) },
          ];
          return <View style={styles.actionGrid}>{Array.from({ length: Math.ceil(actions.length / actionColumns) }, (_, rowIndex) => <View key={rowIndex} style={styles.actionRow}>
            {Array.from({ length: actionColumns }, (_, columnIndex) => {
              const action = actions[rowIndex * actionColumns + columnIndex];
              return action ? <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${action.label} program`} accessibilityState={{disabled:busy}} disabled={busy} onPress={action.onPress} style={[styles.iconAction,busy&&{opacity:0.55}]}>
                <action.Icon accessible={false} size={24} strokeWidth={1.5} color={action.color}/>
                <Text style={[styles.actionLabel,{color:action.color}]}>{action.label}</Text>
              </Pressable> : <View key={columnIndex} style={{flex:1}}/>;
            })}
          </View>)}</View>;
        })()}
        {previousRuns.length ? row("Previous runs", "View completed days", () => setPage("history"), false, false) : null}
      </> : null}
      {page === "details" && draft?.deleting ? <><Text style={styles.muted}>Deletion was interrupted. Routines and saved workouts are unaffected.</Text>{button("Finish deleting program",()=>void execute(async()=>{await deleteStoredProgram(props.uid,draft.id);setPage("library");}),"danger")}</> : null}
      {page === "resume" && draft && selectedRun ? <><Text style={styles.muted}>Continue from the first unfinished day today. Completed dates stay unchanged.</Text>{Array.from({ length: draft.days.length }, (_,index) => {
        const item = programOccurrence(draft, selectedRun, currentProgramOrdinal(draft, selectedRun) + index);
        return <View key={index} style={styles.detailRow}><Text style={styles.rowTitle}>Day {item.dayNumber} · {item.title}</Text><Text style={styles.muted}>{programDateLabel(dateKey(new Date(now + index * 86400000)))}</Text></View>;
      })}{button("Resume today", () => activate("resume"), "primary")}</> : null}
      {page === "history" ? <>{previousRuns.map(item=>row(`${programDateLabel(item.startedDateKey)}${item.endedDateKey?` – ${programDateLabel(item.endedDateKey)}`:""}`,"View completed days",()=>void execute(()=>loadRunHistory(item)),false,true,item.id))}
        {historyEntries.map((item,index)=><View key={index} style={styles.detailRow}><Text style={styles.rowTitle}>Day {item.dayNumber} · {item.title}</Text><Text style={styles.muted}>{programDateLabel(item.dateKey)} · {item.status}</Text></View>)}
        {historyCursor&&selectedRun?button("Earlier days",()=>void execute(()=>loadRunHistory(selectedRun,true))):null}</> : null}
      {page === "schedule" && draft && selectedRun ? <>
        <Text style={styles.rowTitle}>Day {programOccurrence(draft, selectedRun, selectedDay).dayNumber} · {programOccurrence(draft, selectedRun, selectedDay).title}</Text>
        <Text style={styles.muted}>{programDateLabel(programOccurrence(draft, selectedRun, selectedDay).dateKey)}</Text>
        {selectedDay === currentProgramOrdinal(draft, selectedRun) ? <>
          <View style={styles.days}>{(["skip", "move", "swap", "shift"] as const).map(action => button(action === "shift" ? "Tomorrow" : action[0].toUpperCase() + action.slice(1), () => setScheduleAction(action)))}</View>
          {scheduleAction === "skip" || scheduleAction === "shift" ? <>{<Text style={styles.muted}>{scheduleAction === "shift" ? "Move the pending day and all following days to start tomorrow." : "Skip this day without marking a workout complete."}</Text>}{button("Confirm change", () => void execute(() => schedule(scheduleAction)), "primary")}</> : null}
          {scheduleAction === "move" || scheduleAction === "swap" ? Array.from({ length: draft.days.length - 1 }, (_,index) => currentProgramOrdinal(draft, selectedRun) + index + 1).filter(target => scheduleAction !== "move" || programOccurrence(draft, selectedRun, target).type === "rest").map(target => { const item = programOccurrence(draft, selectedRun, target); return row(`Day ${item.dayNumber} · ${item.title}`, programDateLabel(item.dateKey), () => showAppDialog({ title: "Change schedule?", message: `${scheduleAction === "move" ? "Move" : "Swap"} with Day ${item.dayNumber} on ${programDateLabel(item.dateKey)}. Other days keep their dates.`, buttons: [{ text: "Cancel", role: "cancel" }, { text: "Confirm", onPress: () => void execute(() => schedule(scheduleAction, target)) }] })); }) : null}
        </> : <Text style={styles.muted}>Change the first pending day to preserve the program order.</Text>}
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={colors.ink} /> : null}
    </WorkoutModalShell>
  </>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  card: { backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, width: "100%", maxWidth: 560 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "600", flex: 1 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 16 },
  titleAction: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minHeight: 44 },
  programName: { flexShrink: 1 },
  titlePencil: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.rule },
  detailRow: { gap: 8, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" }, muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, paddingVertical: 12 },
  button: { minHeight: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 },
  primary: { backgroundColor: colors.primary, marginTop: 12 }, buttonText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  input: { color: colors.ink, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 18 },
  actionGrid: { gap:24, paddingVertical:16 },
  actionRow: { flexDirection:"row", alignItems:"stretch", gap:12 },
  iconAction: { flex:1, minWidth:0, minHeight:52, alignItems:"center", justifyContent:"flex-start", gap:8, paddingHorizontal:4 },
  actionLabel: { fontSize:14, lineHeight:20, textAlign:"center" },
  days: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  day: { width: 36, height: 40, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, strip: { paddingVertical: 16, gap: 8 },
});
