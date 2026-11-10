import { useSharing } from "../sharing/SharingProvider";
import { programToSharingPlan } from "../sharing/programSharingPlan";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, TouchableOpacity as Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Play, Pencil, Square, RotateCcw, Share2, Trash2, SkipForward, CalendarArrowUp, ArrowLeftRight, CalendarClock } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, getDocsFromServer, limit, orderBy, query, startAfter, where, Timestamp, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { useNotebook, useNotebookStyles, notebookSheet } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import { WorkoutModalShell } from "./workoutLog/WorkoutModalShell";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { showAppDialog } from "../ui/appDialog";
import type { Routine } from "./workoutLog/workoutLogModel";
import { runRef, activateStoredProgram, deleteStoredProgram, saveProgram, stopStoredProgram, updateProgramRun } from "./programStore";
import { addProgramDays, changeProgramSchedule, currentProgramOrdinal, programContinueOrdinal, dateKey, programDayDisplayStatus, emptyProgramDays, programDateLabel, programDayLink, programOccurrence, programSetupError,
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
  const { fontScale, width } = useWindowDimensions();
  const scheduleStripRef = useRef<ScrollView>(null);
  const actionColumns = fontScale >= 1.5 ? 2 : 3;
  const [page, setPage] = useState<"library" | "edit" | "details" | "assign" | "schedule" | "schedule-help" | "resume" | "history" | null>(null);
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
  const selectedOccurrence = draft && selectedRun ? programOccurrence(draft, selectedRun, selectedDay) : null;
  const restDate = page === "schedule" && selectedOccurrence?.type === "rest" ? selectedOccurrence.dateKey : null;
  const restKey = `${props.uid}:${restDate}`;
  const [restWorkouts, setRestWorkouts] = useState<{ key: string; titles: string[]; failed: boolean } | null>(null);
  const [restAttempt, setRestAttempt] = useState(0);
  useEffect(() => {
    if (!restDate) return;
    let alive = true;
    const start = Timestamp.fromDate(new Date(restDate + "T00:00:00"));
    const end = Timestamp.fromDate(new Date(addProgramDays(restDate, 1) + "T00:00:00"));
    void getDocsFromServer(query(collection(db, "users", props.uid, "workouts"), where("date", ">=", start), where("date", "<", end), limit(50)))
      .then(result => { if (alive) setRestWorkouts({ key: restKey, titles: result.docs.map(item => item.data().title || "Untitled workout"), failed: false }); })
      .catch(() => { if (alive) setRestWorkouts({ key: restKey, titles: [], failed: true }); });
    return () => { alive = false; };
  }, [props.uid, restDate, restKey, restAttempt]);
  const execute = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) { setPage(page === "schedule-help" ? "schedule" : null); setError(null); } };
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
    const ordinal = programContinueOrdinal(active, run, dateKey(new Date(now)));
    const occurrence = programOccurrence(active, run, ordinal);
    if (occurrence.type === "rest" || occurrence.status !== "pending") { props.onRestDay(); setDraft(active); setSelectedRun(run); setSelectedDay(ordinal); setScheduleAction(null); setPage("schedule"); return; }
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
  const ordinal = active && run ? programContinueOrdinal(active, run, dateKey(new Date(now))) : 0;
  const continueDay = active && run ? programOccurrence(active, run, ordinal) : null;
  const dayStrip = (program: ProgramRecord, programRun: ProgramRun, selected: number, dates = false) => {
    const cycleStart = Math.floor(programContinueOrdinal(program, programRun, dateKey(new Date(now))) / program.days.length) * program.days.length;
    const pendingOrdinal = currentProgramOrdinal(program, programRun);
    // Keep the next pending day directly tappable even when it begins a new cycle.
    const count = dates ? Math.max(program.days.length, pendingOrdinal - cycleStart + 1) : program.days.length;
    return <ScrollView ref={dates ? scheduleStripRef : undefined} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 8 }} onContentSizeChange={dates ? () => scheduleStripRef.current?.scrollTo({x:Math.max(0,(selected-cycleStart)*48-Math.min(width-40,520)/2+22),animated:false}) : undefined}>
    {Array.from({length:count}, (_, index) => {
      const occurrenceOrdinal = cycleStart + index;
      const item = programOccurrence(program, programRun, occurrenceOrdinal);
      const status = programDayDisplayStatus(item);
      const today = item.dateKey === dateKey(new Date(now));
      const pending = occurrenceOrdinal === currentProgramOrdinal(program, programRun);
      return <View key={index} style={{ alignItems: "center", gap: 4, minWidth: dates ? 44 : 36 }}>
        <Pressable accessibilityRole="button" accessibilityState={{selected:occurrenceOrdinal === selected,disabled:busy}} disabled={busy}
          accessibilityLabel={`Day ${item.dayNumber}, ${item.title}, ${programDateLabel(item.dateKey)}, ${status}${today ? ", today" : ""}${pending ? ", next pending day" : ""}`}
          style={[styles.day, dates && {width:44,minHeight:44}, occurrenceOrdinal === selected && styles.selected, today && styles.today]} onPress={() => { setDraft(program); setSelectedRun(programRun); setSelectedDay(occurrenceOrdinal); setScheduleAction(null); setPage("schedule"); }}>
          <Text style={styles.buttonText}>{status === "completed" || status === "elapsed" ? "✓" : item.dayNumber}</Text>
        </Pressable>
        {dates ? <><Text style={[styles.muted,{fontSize:12,lineHeight:16}]}>{item.dateKey.slice(5).replace("-","/")}</Text><Text style={[styles.muted,{fontSize:12,lineHeight:16,color:today?colors.accent:colors.muted}]}>{today ? "Today" : status === "skipped" ? "Skipped" : ""}</Text></> : null}
      </View>;
    })}
  </ScrollView>;
  };
  return <>
    {props.choices ? <View>
      {props.hasDraft ? row("Resume workout", "Open saved workout drafts", props.onResume, true) : null}
      {active ? row("Continue program", `${active.name} · Day ${continueDay?.dayNumber ?? ordinal % active.days.length + 1}${continueDay?.status === "completed" ? " · Completed" : continueDay?.status === "skipped" ? " · Skipped" : ""}`, () => void execute(continueProgram), !props.hasDraft) : null}
      {row("Create program", "Assign your routines to workout and rest days", newProgram)}
      {row("Start workout", "Choose a routine or build today's workout", () => void execute(props.onStandalone), !props.hasDraft && !active)}
      {row("My programs", props.data.programs.length ? `${props.data.programs.length} saved` : "Your saved programs", () => setPage("library"))}
      {!props.data.loaded && !props.data.error ? <ActivityIndicator color={colors.ink} /> : null}
      {props.data.error ? <><Text style={styles.error}>{props.data.error}</Text>{button("Try again", props.data.retry)}</> : null}
    </View> : active && run ? <View style={styles.strip}>
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Edit program title" style={styles.titleAction} onPress={() => open(active, "edit")}><Text style={[styles.rowTitle, styles.programName]}>{active.name}</Text><View style={styles.titlePencil}><Pencil size={18} strokeWidth={1.5} color={colors.muted} /></View></Pressable><Text style={styles.muted}>Week {Math.max(1, Math.floor((Date.parse(dateKey()) - Date.parse(run.startedDateKey)) / 604800000) + 1)}</Text></View>
      {dayStrip(active, run, ordinal)}
    </View> : null}
    {error && !page ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <WorkoutModalShell compactLandscape androidBehavior="padding" visible={page !== null} onRequestClose={close} backdropStyle={styles.overlay} cardStyle={styles.card}>
      <View style={styles.heading}><View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}><Text style={[styles.title, page === "schedule" && { flex: 0, flexShrink: 1 }]}>{page === "library" ? "My programs" : page === "assign" ? `Routine for Day ${selectedDay + 1}` : page === "edit" ? "Program" : page === "schedule" ? "Change schedule" : page === "schedule-help" ? "Schedule changes" : page === "resume" ? "Resume program" : page === "history" ? "Previous runs" : draft?.name}</Text>{page === "schedule" ? <NotebookInfoButton label="About schedule changes" onPress={() => setPage("schedule-help")} /> : null}</View><Pressable accessibilityLabel="Close" hitSlop={12} onPress={close} disabled={busy}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
      {page === "schedule-help" ? <View style={{ gap: 16 }}>
        <Text style={styles.muted}>Change your next pending day.</Text>
        <View>{[
          {label:"Skip",detail:"Leave this day in history as skipped.",Icon:SkipForward},
          {label:"Move",detail:"Exchange it with a future rest day.",Icon:CalendarArrowUp},
          {label:"Swap",detail:"Exchange it with another future day.",Icon:ArrowLeftRight},
          {label:"Tomorrow",detail:"Start this day tomorrow. Shift following days too.",Icon:CalendarClock},
        ].map(({label,detail,Icon},index)=><View key={label} style={{flexDirection:"row",alignItems:"center",gap:16,paddingVertical:14,borderBottomWidth:index===3?0:1,borderBottomColor:colors.rule}}><Icon size={22} strokeWidth={1.5} color={colors.ink}/><View style={{flex:1,gap:4}}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.muted}>{detail}</Text></View></View>)}</View>
      </View> : null}
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
        {dayStrip(draft, selectedRun, selectedDay, true)}
        <Text style={styles.rowTitle}>Day {selectedOccurrence?.dayNumber} · {selectedOccurrence?.type === "rest" && selectedOccurrence.title === "Rest" ? "Rest day" : selectedOccurrence?.title}</Text>
        <Text style={styles.muted}>{programDateLabel(programOccurrence(draft, selectedRun, selectedDay).dateKey)}</Text>
        {selectedOccurrence?.status === "completed" ? <Text style={styles.muted}>Completed</Text> : null}
        {selectedDay === currentProgramOrdinal(draft, selectedRun) ? <>
          <View style={styles.scheduleActions}>{([
            { action: "skip", label: "Skip", Icon: SkipForward },
            { action: "move", label: "Move", Icon: CalendarArrowUp },
            { action: "swap", label: "Swap", Icon: ArrowLeftRight },
            { action: "shift", label: "Tomorrow", Icon: CalendarClock },
          ] as const).map(({ action, label, Icon }) => <Pressable key={action} accessibilityRole="button" accessibilityState={{ selected: scheduleAction === action, disabled: busy }} disabled={busy} onPress={() => setScheduleAction(action)} style={[styles.scheduleAction, scheduleAction === action && { backgroundColor: colors.subtle }]}>
            <Icon size={22} strokeWidth={1.5} color={colors.ink} />
            <Text style={styles.scheduleLabel}>{label}</Text>
          </Pressable>)}</View>
          {scheduleAction === "skip" || scheduleAction === "shift" ? <>{<Text style={styles.muted}>{scheduleAction === "shift" ? "Move the pending day and all following days to start tomorrow." : "Skip this day without marking a workout complete."}</Text>}{button("Confirm change", () => void execute(() => schedule(scheduleAction)), "primary")}</> : null}
          {scheduleAction === "move" || scheduleAction === "swap" ? Array.from({ length: draft.days.length - 1 }, (_,index) => currentProgramOrdinal(draft, selectedRun) + index + 1).filter(target => scheduleAction !== "move" || programOccurrence(draft, selectedRun, target).type === "rest").map(target => { const item = programOccurrence(draft, selectedRun, target); return row(`Day ${item.dayNumber} · ${item.title}`, programDateLabel(item.dateKey), () => showAppDialog({ title: "Change schedule?", message: `${scheduleAction === "move" ? "Move" : "Swap"} with Day ${item.dayNumber} on ${programDateLabel(item.dateKey)}. Other days keep their dates.`, buttons: [{ text: "Cancel", role: "cancel" }, { text: "Confirm", onPress: () => void execute(() => schedule(scheduleAction, target)) }] })); }) : null}
        </> : <>
          <Text style={styles.muted}>{selectedOccurrence && programDayDisplayStatus(selectedOccurrence) === "elapsed" ? "This rest day has passed. Your next unfinished workout stays pending." : selectedOccurrence?.status !== "pending" ? "This day is saved in your program history." : "An earlier day is still pending. Change that day first to keep your program in order."}</Text>
        </>}
        {restDate ? restWorkouts?.key !== restKey ? <ActivityIndicator accessibilityLabel="Checking for additional workouts" color={colors.ink} /> : restWorkouts.failed ? <View>
          <Text style={styles.error}>Couldn&apos;t check for additional workouts.</Text>{button("Try again", () => setRestAttempt(value => value + 1))}
        </View> : restWorkouts.titles.length ? <View style={[styles.detailRow,{borderBottomWidth:0}]}>
          <Text style={styles.rowTitle}>Additional workouts</Text>
          {restWorkouts.titles.map((title, index) => <Text key={index} style={styles.muted}>{title}</Text>)}
        </View> : null : null}
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
  scheduleActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, paddingVertical: 16 },
  scheduleAction: { flexGrow: 1, flexBasis: 64, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8 },
  scheduleLabel: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: "center" },
  days: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  day: { width: 36, height: 40, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  selected: { borderColor: colors.ink, backgroundColor: colors.subtle },
  today: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, strip: { paddingVertical: 16, gap: 8 },
});
