export const guideTopics = [
  { id: "home", title: "Explore Home and recovery", route: "/(tabs)/home" },
  { id: "workout", title: "Log a workout", route: "/(tabs)/workout/log" },
  { id: "routines", title: "Create a routine", route: "/(tabs)/workout/log" },
  { id: "programs", title: "Build a program", route: "/(tabs)/workout/log" },
  { id: "plan", title: "Review Today's Plan", route: "/(tabs)/workout/log" },
  { id: "sharing", title: "Share workouts and programs", route: "/(tabs)/workout/log" },
  { id: "nutrition", title: "Log food", route: "/(tabs)/nutrition" },
  { id: "sleep", title: "Record sleep", route: "/(tabs)/sleep" },
  { id: "profile", title: "Set up your profile", route: "/(tabs)/profile" },
  { id: "health", title: "Connect health data", route: "/(tabs)/profile" },
] as const;
export type GuideTopic = typeof guideTopics[number]["id"];
export type GuideState = { active: boolean; owner: string | null; topic: GuideTopic | null; workoutTopic: GuideTopic; dismissed: string[]; events: string[] };
export const emptyGuide = (): GuideState => ({ active: false, owner: null, topic: null, workoutTopic: "workout", dismissed: [], events: [] });
const workoutTopics: GuideTopic[] = ["workout", "routines", "programs", "plan"];
export type GuideAction = { type: "begin"; owner: string } | { type: "start"; owner: string; topic: GuideTopic } | { type: "end" } | { type: "route"; owner: string; path: string } | { type: "dismiss" | "event"; owner: string; id: string };
export function guideReducer(state: GuideState, action: GuideAction): GuideState {
  if (action.type === "end") return emptyGuide();
  if (action.type === "begin") return { ...emptyGuide(), active: true, owner: action.owner };
  if (action.type === "start") return { active: true, owner: action.owner, topic: action.topic, workoutTopic: workoutTopics.includes(action.topic) ? action.topic : state.owner === action.owner ? state.workoutTopic : "workout", dismissed: [], events: state.owner === action.owner ? state.events : [] };
  if (!state.active || state.owner !== action.owner) return state;
  // Visiting a tab does not opt the user into another topic.
  if (action.type === "route") return state;
  const key = action.type === "dismiss" ? "dismissed" : "events";
  return state[key].includes(action.id) ? state : { ...state, [key]: [...state[key], action.id] };
}

export function guideTopicOnPath(topic: GuideTopic, path: string, tipId: string) {
  if (topic === "health") return path === "/profile" || path.startsWith("/profile/");
  if (topic === "sharing") return true; // Sharing dialogs can open over any tab.
  if (tipId === "workout-complete" && path === "/home") return true;
  if (["workout", "routines", "programs", "plan"].includes(topic)) return path.startsWith("/workout");
  return path === `/${topic}` || path.startsWith(`/${topic}/`);
}
