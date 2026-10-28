import { exerciseTargetsText } from "../workouts/exerciseTargets";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { showAppAlert } from "../ui/appDialog";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
  collection,
  documentId,
  query as firestoreQuery,
  limit,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { Ban, Check, CheckCircle2, CircleAlert, Clock3, Copy, Mail, MessageCircle, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, Switch, Text, View, useWindowDimensions } from "react-native";
import { db } from "../config/firebaseConfig";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import { rpeToEffort } from "../workouts/effortScale";
import { WorkoutModalShell } from "../workouts/workoutLog/WorkoutModalShell";
import { createStyles } from "../workouts/workoutLog/workoutLogStyles";
import { SharingPlanEditor } from "./SharingPlanEditor";
import { sharingDraftMessage, sharingEmailDraftUrl } from "./sharingLinkDraft";
import { queueSharedWorkout } from "./sharingBridge";
import {
  SHARING_LIMITS,
  normalizeSharingUsername,
  validSharingUsername,
} from "./sharingContract";
import { omitSharingWeights } from "./sharingPlan";
import {
  sendWorkoutInLastrep,
  sharingCall as invokeSharing,
  sharingError,
  type SharedWorkoutPlan,
  type SharingCursor,
  type SharingDelivery,
  type SharingPerson,
  type SharingSent,
  type SharingSnapshot,
} from "./sharingService";
type Props = {
  uid: string | null;
  screen: "center" | "send" | "username" | "link";
  initialPlan: SharedWorkoutPlan | null;
  token: string;
  username: string;
  enabled: boolean;
  unreadCount: number;
  requestCount: number;
  onSignInRequested: () => void;
  onClose: () => void;
  onUsernameSaved: (username: string) => void;
};
type Step =
  | "center"
  | "preview"
  | "edit"
  | "people"
  | "result"
  | "external";
type Outcome = SharingPerson & {
  status: string;
};
type Item = SharingDelivery | SharingSent;
type CachedSharingList = { key: string; items: Item[]; cursor: SharingCursor };
const EMPTY_SHARING_ITEMS: Item[] = [];
export function SharingDialogs({
  uid,
  screen,
  initialPlan,
  token,
  username,
  enabled,
  unreadCount,
  requestCount,
  onSignInRequested,
  onClose,
  onUsernameSaved,
}: Props) {
  const sharingCall = useCallback(
    function scopedSharingCall<T>(
      op: string,
      data: Record<string, unknown> = {},
    ) {
      return invokeSharing<T>(op, { ...data, expectedUid: uid });
    },
    [uid],
  );
  const { colors } = useNotebook(),
    styles = useNotebookStyles(createStyles),
    router = useRouter();
  const { height: windowHeight, width: windowWidth, fontScale } = useWindowDimensions();
  const centerHeight = Math.min(480, windowHeight * 0.82);
  const inlineRequestActions = windowWidth >= 360 && fontScale < 1.5;
  const [step, setStep] = useState<Step>(
      screen === "center" ? "center" : "preview",
    ),
    [tab, setTab] = useState<"Inbox" | "Requests" | "Sent">("Inbox");
  const [name, setName] = useState(username),
    [plan, setPlan] = useState(initialPlan),
    [snapshot, setSnapshot] = useState<SharingSnapshot | null>(null),
    [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loadedItems, setItems] = useState<Item[]>([]),
    [loadedCursor, setCursor] = useState<SharingCursor>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [pageSize, setPageSize] = useState(40),
    [listReadyKey, setListReadyKey] = useState("");
  const [retentionTick, setRetentionTick] = useState(0);
  const [listCache, setListCache] = useState<Record<string, CachedSharingList>>({});
  const listKey = `${uid}:${tab}:${pageSize}:${retentionTick}`;
  const cachedList = listCache[`${uid}:${tab}`];
  const currentListReady = listReadyKey === listKey;
  const cachedListReady = cachedList?.key === listKey;
  const items = currentListReady ? loadedItems : cachedListReady ? cachedList.items : EMPTY_SHARING_ITEMS;
  const cursor = currentListReady ? loadedCursor : cachedListReady ? cachedList.cursor : null;
  const loadingList = !currentListReady && !cachedListReady;
  const [includeWeights, setIncludeWeights] = useState(true),
    [query, setQuery] = useState(""),
    [searchResult, setSearchResult] = useState<{
      query: string;
      people: SharingPerson[];
    }>({ query: "", people: [] }),
    [selected, setSelected] = useState<SharingPerson[]>([]),
    [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [link, setLink] = useState<{
    url: string;
    snapshotId: string;
  } | null>(null);
  const mounted = useRef(true),
    locked = useRef(false);
  const people = searchResult.query === query ? searchResult.people : [];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(sharingError(e));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (!uid || step !== "center") return;
    let active = true;
    void sharingCall("cleanup").catch(() => undefined);
    const source = collection(
      db,
      "users",
      uid,
      tab === "Sent" ? "sharingSent" : "sharingInbox",
    );
    const list = firestoreQuery(
      source,
      ...(tab === "Sent"
        ? []
        : [where("status", "==", tab === "Requests" ? "request" : "inbox")]),
      where(
        "createdAtMs",
        ">",
        Date.now() - SHARING_LIMITS.historyDays * 86400_000,
      ),
      orderBy("createdAtMs", "desc"),
      orderBy(documentId(), "desc"),
      limit(pageSize),
    );
    const stop = onSnapshot(
      list,
      (snapshot) => {
        if (!active) return;
        const nextItems = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Item);
        const last = snapshot.docs[snapshot.docs.length - 1];
        const nextCursor = snapshot.size === pageSize && last
          ? { createdAtMs: last.data().createdAtMs, id: last.id }
          : null;
        setItems(nextItems);
        setCursor(nextCursor);
        setListCache((cache) => ({
          ...cache,
          [`${uid}:${tab}`]: { key: listKey, items: nextItems, cursor: nextCursor },
        }));
        setListReadyKey(listKey);
      },
      (e) => {
        if (active) {
          setError(sharingError(e));
          setItems([]);
          setCursor(null);
          setListReadyKey(listKey);
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [uid, step, tab, pageSize, listKey, sharingCall]);
  useEffect(() => {
    if (screen === "link")
      void run(async () => {
        const result = await sharingCall<SharingSnapshot>("snapshot", {
          token,
        });
        if (mounted.current) {
          setSnapshot(result);
          setPlan(result.plan);
        }
      }); /* Opening owns one initial request. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (step !== "people" || query.trim().replace(/^@/, "").length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void sharingCall<{ people: SharingPerson[] }>("search", { query })
        .then((result) => {
          if (!cancelled) setSearchResult({ query, people: result.people });
        })
        .catch((e) => {
          if (!cancelled) setError(sharingError(e));
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, step, sharingCall]);
  const close = () => {
    if (busy) return;
    if (step === "edit") {
      setStep("preview");
      return;
    }
    onClose();
  };
  useEffect(() => {
    if (step !== "center" || !items.length) return;
    const nextExpiry = Math.min(
      ...items.map(
        (item) => item.createdAtMs + SHARING_LIMITS.historyDays * 86400_000,
      ),
    );
    const timer = setTimeout(
      () => setRetentionTick((value) => value + 1),
      Math.max(50, Math.min(nextExpiry - Date.now() + 50, 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [items, step]);
  const openItem = (item: Item) =>
    void run(async () => {
      const result = await sharingCall<SharingSnapshot>(
        "snapshot",
        "sender" in item ? { deliveryId: item.id } : { sentId: item.id },
      );
      if (!mounted.current) return;
      setSnapshot(result);
      setPlan(result.plan);
      setSelectedItem(item);
      setIncludeWeights(true);
      setStep("preview");
      if ("sender" in item && item.unread) {
        await sharingCall("respond", { deliveryId: item.id, action: "read" });
        setItems((old) =>
          old.map((i) => (i.id === item.id ? { ...i, unread: false } : i)),
        );
      }
    });
  const respond = (item: SharingDelivery, action: string) =>
    void run(async () => {
      await sharingCall("respond", { deliveryId: item.id, action });
      setFeedback(
        action === "accept"
          ? "Request accepted. Open the workout from Inbox."
          : action === "block"
            ? "Sender blocked."
            : "Request declined.",
      );
    });
  const outgoing = plan
    ? includeWeights
      ? plan
      : omitSharingWeights(plan)
    : null;
  const send = () =>
    void run(async () => {
      if (!outgoing || !uid) return;
      const result = await sendWorkoutInLastrep(
        uid,
        outgoing,
        selected.map((p) => p.uid),
      );
      if (mounted.current) {
        setOutcomes(result.recipients);
        setStep("result");
      }
    });
  const createLink = () =>
    void run(async () => {
      if (!outgoing) return;
      const result = await sharingCall<{
        token: string;
        snapshotId: string;
      }>("link", { plan: outgoing });
      const base = process.env.EXPO_PUBLIC_WORKOUT_SHARING_URL;
      const url =
        base && /^https:\/\//.test(base)
          ? `${base.replace(/\/$/, "")}/w/${result.token}`
          : Linking.createURL(`w/${result.token}`);
      if (mounted.current) {
        setLink({ url, snapshotId: result.snapshotId });
        setStep("external");
      }
    });
  const externalDraft = (kind: "messages" | "email" | "chooser" | "copy") =>
    void run(async () => {
      if (!link) return;
      const message = sharingDraftMessage(plan?.title || "Workout", link.url);
      if (kind === "copy") {
        await Clipboard.setStringAsync(link.url);
        setFeedback("Link copied.");
      } else if (kind === "chooser") await Share.share({ message });
      else
        await Linking.openURL(
          kind === "messages"
            ? `sms:?body=${encodeURIComponent(message)}`
            : sharingEmailDraftUrl(plan?.title || "Workout", link.url),
        );
    });
  const useWorkout = () => {
    if (!uid || !plan) {
      setError("Sign in to use this workout.");
      return;
    }
    queueSharedWorkout(uid, plan);
    onClose();
    router.navigate({
      pathname: "/workout/log",
      params: { sharedIntent: String(Date.now()) },
    });
  };
  const saveRoutine = () =>
    void run(async () => {
      await sharingCall<{
        created: boolean;
      }>(
        "importRoutine",
        screen === "link"
          ? { token }
          : selectedItem && "sender" in selectedItem
            ? { deliveryId: selectedItem.id }
            : { sentId: selectedItem?.id },
      );
      if (mounted.current) {
        onClose();
        router.navigate({
          pathname: "/workout/log",
          params: { showSharedRoutines: String(Date.now()) },
        });
      }
    });
  const visible = items.filter((i) =>
    tab === "Sent"
      ? !("sender" in i)
      : "sender" in i &&
        i.status === (tab === "Requests" ? "request" : "inbox"),
  );
  const sentPreview = selectedItem && !("sender" in selectedItem);
  const title =
    screen === "username"
      ? "Username"
      : step === "center"
        ? "Workout sharing"
        : step === "edit"
          ? "Edit workout"
          : step === "people"
            ? "Send in Lastrep"
            : step === "result"
                ? outcomes.length === 1 && outcomes[0].status === "request"
                  ? "Sharing request sent"
                  : outcomes.length === 1 && outcomes[0].status === "awaiting-acceptance"
                    ? "Request pending"
                  : outcomes.some((person) => person.status === "inbox" || person.status === "request")
                    ? "Workout sent"
                    : "Sharing update"
                : step === "external"
                  ? "Share with"
                  : sentPreview
                    ? "Sent workout"
                    : screen === "center" || screen === "link"
                      ? "Shared workout"
                      : "Review workout";
  return (
    <WorkoutModalShell
      visible
      onRequestClose={close}
      dismissOnBackdropPress={!busy}
      backdropStyle={styles.modalBackdrop}
      cardStyle={{ ...styles.modalCard, maxWidth: step === "edit" ? 760 : 600, ...(step === "center" ? { height: centerHeight } : {}) }}
    >
      {step === "edit" && plan ? (
        <SharingPlanEditor
          plan={plan}
          onCancel={() => setStep("preview")}
          onReview={(next) => {
            setPlan(next);
            setSelectedItem(null);
            setSnapshot(null);
            setStep("preview");
          }}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Text
              accessibilityRole="header"
              style={[styles.modalTitle, { flexShrink: 1, marginBottom: 0 }]}
            >
              {title}
            </Text>
            {step === "center" && (
              <NotebookInfoButton
                label="About workout sharing"
                onPress={() =>
                  showAppAlert(
                    "Workout sharing",
                    `Sharing history and links expire after ${SHARING_LIMITS.historyDays} days. Saved workouts and routines stay in your account. Sharing the plan again creates a new delivery.`,
                  )
                }
              />
            )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close workout sharing"
              disabled={busy}
              onPress={close}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>
          <View style={{ gap: 14, marginTop: 16 }}>
          {screen === "username" ? (
            <>
              <Text style={styles.modalText}>
                People can find your nickname and @username when sharing is on.
              </Text>
              <NotebookTextInput
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setError("");
                }}
                placeholder="Choose a username"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {
                <SharingButton
                  label={"Save username"}
                  onPress={() =>
                    void run(async () => {
                      const value = normalizeSharingUsername(name);
                      if (!validSharingUsername(value))
                        throw Error(
                          "Use 3 to 24 letters, numbers, dots or underscores.",
                        );
                      await sharingCall("username", { username: value });
                      if (mounted.current) onUsernameSaved(value);
                    })
                  }
                  primary={true}
                  busy={busy}
                />
              }
            </>
          ) : step === "center" ? (
            <>
              <View style={styles.answerRow}>
                {(["Inbox", "Requests", "Sent"] as const).map((kind) => {
                  const count =
                    kind === "Inbox"
                      ? unreadCount
                      : kind === "Requests"
                        ? requestCount
                        : 0;
                  return (
                    <Pressable
                      key={kind}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === kind }}
                      style={[
                        styles.answerChip,
                        tab === kind && styles.answerChipActive,
                      ]}
                      disabled={busy}
                      onPress={() => {
                        setTab(kind);
                        setPageSize(40);
                        setError("");
                        setFeedback("");
                      }}
                    >
                      <Text
                        style={[
                          styles.answerText,
                          tab === kind && styles.answerTextActive,
                        ]}
                      >
                        {kind}
                        {count ? ` (${count})` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <ScrollView
                style={{ height: Math.max(120, centerHeight - 180), flexGrow: 0 }}
                keyboardShouldPersistTaps="handled"
              >
                {loadingList && (
                  <Text style={styles.muted}>Loading workouts…</Text>
                )}
                {visible.length === 0 && !busy && !loadingList && (
                  <Text style={styles.modalText}>
                    {tab === "Requests"
                      ? "No sharing requests."
                      : tab === "Sent"
                        ? "No workouts sent yet."
                        : "No shared workouts yet."}
                  </Text>
                )}
                {!loadingList && visible.map((item, itemIndex) => (
                  <View
                    key={item.id}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: itemIndex < visible.length - 1 ? 1 : 0,
                      borderBottomColor: colors.rule,
                      gap: 12,
                      flexDirection: "sender" in item && item.status === "request" && inlineRequestActions ? "row" : "column",
                    }}
                  >
                    <Pressable
                      disabled={
                        busy || ("sender" in item && item.status === "request")
                      }
                      accessible={
                        !("sender" in item && item.status === "request")
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.title}`}
                      accessibilityHint="View this shared workout"
                      accessibilityState={{ disabled: busy }}
                      onPress={() => openItem(item)}
                      style={{ minHeight: 48, gap: 8, paddingVertical: 4, ...("sender" in item && item.status === "request" && inlineRequestActions ? { flex: 1, minWidth: 0 } : {}) }}
                    >
                      <Text style={[styles.sectionTitle, "sender" in item && item.status === "request" && { marginBottom: 0 }]}>{item.title}</Text>
                      {"sender" in item && item.status === "request" ? (
                        <View style={{ gap: 2 }}>
                          <Text style={styles.muted}>{item.sender.nickname}</Text>
                          <Text style={styles.muted}>@{item.sender.username}</Text>
                        </View>
                      ) : (
                        <Text style={styles.muted}>
                          {"sender" in item
                            ? `${item.sender.nickname} · @${item.sender.username}`
                            : item.recipients
                                .map((p) => `${p.nickname} · @${p.username}`)
                                .join(", ")}
                        </Text>
                      )}
                      <Text style={styles.muted}>
                        {new Date(item.createdAtMs).toLocaleString()}
                      </Text>
                    </Pressable>
                    {"sender" in item && item.status === "request" ? (
                      <View style={{ flexDirection: "row", gap: inlineRequestActions ? 4 : 12, alignSelf: inlineRequestActions ? "center" : "stretch" }}>
                        {([
                          { action: "accept", label: "Accept", Icon: Check },
                          { action: "decline", label: "Decline", Icon: X },
                          { action: "block", label: "Block", Icon: Ban },
                        ] as const).map(({ action, label, Icon }) => (
                          <Pressable
                            key={action}
                            accessibilityRole="button"
                            accessibilityLabel={action === "block" ? `Block sender ${item.sender.nickname}` : `${label} sharing request from ${item.sender.nickname}`}
                            disabled={busy}
                            onPress={() => respond(item, action)}
                            style={{ ...(inlineRequestActions ? { width: 48 } : { flex: 1 }), minWidth: 48, minHeight: 56, paddingVertical: 4, alignItems: "center", gap: 6, opacity: busy ? 0.5 : 1 }}
                          >
                            <Icon size={22} strokeWidth={1.7} color={action === "accept" ? colors.accent : colors.muted} />
                            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <>
                        {"sender" in item && (
                          <SharingButton
                            label={"Block sender"}
                            onPress={() => respond(item, "block")}
                            busy={busy}
                          />
                        )}
                      </>
                    )}
                  </View>
                ))}
                {!loadingList && cursor && (
                  <SharingButton
                    label={"Show more"}
                    onPress={() => setPageSize((size) => size + 40)}
                    busy={busy}
                  />
                )}
              </ScrollView>
            </>
          ) : step === "people" ? (
            <>
              <Text style={styles.modalText}>
                Find people who have turned on sharing.
              </Text>
              <NotebookTextInput
                accessibilityLabel="Search people"
                autoCapitalize="none"
                placeholder="Nickname or @username"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setError("");
                }}
                style={styles.input}
              />
              {!!selected.length && <View style={styles.answerRow}>
                {selected.map((p) => (
                  <Pressable
                    key={p.uid}
                    accessibilityLabel={`Remove @${p.username}`}
                    style={styles.answerChip}
                    onPress={() =>
                      setSelected((all) =>
                        all.filter((other) => other.uid !== p.uid),
                      )
                    }
                  >
                    <Text style={styles.answerText}>@{p.username} ×</Text>
                  </Pressable>
                ))}
              </View>}
              {!!people.length && <ScrollView
                style={{ maxHeight: 300 }}
                keyboardShouldPersistTaps="handled"
              >
                {people.map((p) => (
                  <Pressable
                    key={p.uid}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: selected.some((other) => other.uid === p.uid),
                    }}
                    style={styles.pickerRow}
                    onPress={() => {
                      setSelected((all) =>
                        all.some((other) => other.uid === p.uid)
                          ? all.filter((other) => other.uid !== p.uid)
                          : all.length < 10
                            ? [...all, p]
                            : all,
                      );
                    }}
                  >
                    <Text style={styles.pickerText}>
                      {selected.some((other) => other.uid === p.uid)
                        ? "✓ "
                        : ""}
                      {p.nickname} · @{p.username}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>}
              {query.trim().replace(/^@/, "").length >= 2 && searchResult.query === query && !people.length && (
                <Text style={styles.muted}>No people found.</Text>
              )}
              <Text style={styles.muted}>Each person receives a separate workout.</Text>
              <SharingButton
                label={selected.length > 1 ? `Send workout to ${selected.length} people` : "Send workout"}
                onPress={send}
                primary
                disabled={!selected.length}
                busy={busy}
              />
              {
                <SharingButton
                  label={"Back"}
                  onPress={() => setStep("preview")}
                  busy={busy}
                />
              }
            </>
          ) : step === "result" ? (
            <>
              <Text style={styles.muted}>
                {outcomes.length === 1 && outcomes[0].status === "inbox"
                  ? "They'll find your workout in their Inbox."
                  : outcomes.length === 1 && outcomes[0].status === "request"
                    ? "They'll see your request in Workout sharing."
                    : outcomes.length === 1 && outcomes[0].status === "awaiting-acceptance"
                      ? "You can send another workout after they accept your request."
                    : outcomes.some((person) => person.status === "inbox" || person.status === "request")
                      ? "Each person gets a separate copy. See their status below."
                      : "This workout was not sent. You can try again from Review workout."}
              </Text>
              <View style={{ gap: 10, marginTop: 6 }}>
                {outcomes.map((person) => {
                  const delivered = person.status === "inbox";
                  const requested = person.status === "request";
                  const awaiting = person.status === "awaiting-acceptance";
                  const Icon = delivered ? CheckCircle2 : requested || awaiting ? Clock3 : CircleAlert;
                  return (
                    <View key={person.uid} style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 14, borderRadius: 12, borderWidth: 1,
                      borderColor: colors.rule, backgroundColor: colors.subtle,
                    }}>
                      <Icon size={20} color={delivered || requested ? colors.accent : awaiting ? colors.muted : colors.danger} strokeWidth={1.7} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.modalText, { fontWeight: "600" }]}>{person.nickname}</Text>
                        <Text style={styles.muted}>
                          {delivered ? "In their inbox" : requested ? "Sharing request sent" : awaiting ? "Awaiting acceptance" : "Could not send"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : step === "external" ? (
            <>
              <Text style={styles.modalText}>
                {process.env.EXPO_PUBLIC_WORKOUT_SHARING_URL
                  ? `Anyone with this link can view the workout for ${SHARING_LIMITS.linkDays} days.`
                  : `This development link can open a workout in Lastrep Dev for ${SHARING_LIMITS.linkDays} days.`}
                {" "}Messages and Email open drafts for you to send.
              </Text>
              {!process.env.EXPO_PUBLIC_WORKOUT_SHARING_URL && (
                <Text style={styles.muted}>
                  Some messaging apps do not open development links. A public web link is not available yet.
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-around",
                  gap: 12,
                }}
              >
                {(
                  [
                    {
                      kind: "messages",
                      label: "Messages",
                      Icon: MessageCircle,
                    },
                    { kind: "email", label: "Email", Icon: Mail },
                    { kind: "copy", label: "Copy link", Icon: Copy },
                  ] as const
                ).map(({ kind, label, Icon }) => (
                  <Pressable
                    key={kind}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => externalDraft(kind)}
                    style={{
                      minWidth: 76,
                      minHeight: 72,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Icon color={colors.ink} size={24} strokeWidth={1.5} />
                    <Text style={styles.modalText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SharingButton label="More apps" onPress={() => externalDraft("chooser")} busy={busy} />
                </View>
                <View style={{ flex: 1 }}>
                  <SharingButton
                    label="Revoke link"
                    onPress={() =>
                      void run(async () => {
                        await sharingCall("revokeLink", { snapshotId: link?.snapshotId });
                        setLink(null);
                        setStep("preview");
                        setFeedback("Link revoked.");
                      })
                    }
                    busy={busy}
                  />
                </View>
              </View>
              {
                <SharingButton
                  label={"Back"}
                  onPress={() => setStep("preview")}
                  busy={busy}
                />
              }
            </>
          ) : plan ? (
            <>
              {snapshot && !sentPreview && (
                <Text style={styles.muted}>
                  From {snapshot.sender.nickname}
                  {snapshot.sender.username
                    ? ` · @${snapshot.sender.username}`
                    : ""}
                </Text>
              )}
              <SharingPlanPreview plan={outgoing!} />
              {screen === "send" || !snapshot ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={styles.modalText}>Include weights</Text>
                    <Switch
                      accessibilityLabel="Include weights"
                      value={includeWeights}
                      onValueChange={setIncludeWeights}
                    />
                  </View>
                  {
                    <SharingButton
                      label={"Send in Lastrep"}
                      onPress={() => {
                        setStep("people");
                      }}
                      primary={true}
                      disabled={!enabled}
                      busy={busy}
                    />
                  }
                  {!enabled && (
                    <Text style={styles.muted}>
                      Choose a username and turn on sharing in Settings to send
                      in Lastrep.
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <SharingButton label="Edit workout" onPress={() => setStep("edit")} busy={busy} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SharingButton label="Share a link" onPress={createLink} busy={busy} />
                    </View>
                  </View>
                </>
              ) : sentPreview ? (
                <>
                  <Text style={styles.muted}>
                    {(selectedItem as SharingSent).recipients
                      .map((p) => `${p.nickname} · @${p.username}`)
                      .join(", ")}
                  </Text>
                  {
                    <SharingButton
                      label={"Edit workout"}
                      onPress={() => {
                        setSelected((selectedItem as SharingSent).recipients);
                        setStep("edit");
                      }}
                      busy={busy}
                    />
                  }
                  {
                    <SharingButton
                      label={"Send again"}
                      onPress={() => {
                        setSelected((selectedItem as SharingSent).recipients);
                        setQuery("");
                        setStep("people");
                      }}
                      busy={busy}
                    />
                  }
                </>
              ) : (
                <>
                  {uid ? (
                    <SharingButton
                      label={"Use for a new workout"}
                      onPress={useWorkout}
                      primary={true}
                      busy={busy}
                    />
                  ) : (
                    <SharingButton
                      label="Sign in to use this workout"
                      onPress={() => {
                        onSignInRequested();
                        onClose();
                        router.push("/auth/sign-in");
                      }}
                      primary
                      busy={busy}
                    />
                  )}
                  {uid && (
                    <SharingButton
                      label={"Save to My routines"}
                      onPress={saveRoutine}
                      busy={busy}
                    />
                  )}
                </>
              )}
              {screen === "center" && (
                <SharingButton
                  label={"Back"}
                  onPress={() => {
                    setSelectedItem(null);
                    setPlan(null);
                    setSnapshot(null);
                    setStep("center");
                  }}
                  busy={busy}
                />
              )}
            </>
          ) : (
            !busy &&
            !error && (
              <Text style={styles.modalText}>
                This shared workout is unavailable.
              </Text>
            )
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          )}
          {!!feedback && (
            <Text accessibilityLiveRegion="polite" style={styles.modalText}>
              {feedback}
            </Text>
          )}
          {busy && (
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              Please wait…
            </Text>
          )}
          </View>
        </>
      )}
    </WorkoutModalShell>
  );
}
export function SharingPlanPreview({ plan }: { plan: SharedWorkoutPlan }) {
  const styles = useNotebookStyles(createStyles);
  return (
    <ScrollView style={{ maxHeight: 350 }}>
      <Text style={[styles.sessionTitle, { marginBottom: 16 }]}>{plan.title}</Text>
      {plan.exercises.map((e, i) => {
        let working = 0;
        return (
          <View key={`${i}:${e.name}`} style={[styles.card, { borderTopWidth: 0, paddingHorizontal: 12, borderRadius: 12 }]}>
            <Text style={styles.sectionTitle}>
              {String(i + 1).padStart(2, "0")} · {e.name}
            </Text>
            <Text style={styles.muted}>
              Rest {e.restSec}s{e.tempo ? ` · Tempo ${e.tempo}` : ""}
            </Text>
            {e.mode === "cardio" &&
              (e.cardioSessionType || e.cardioEffortLevel) && (
                <Text style={styles.muted}>
                  {[e.cardioSessionType, e.cardioEffortLevel]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            {!!e.instructions && (
              <Text style={styles.modalText}>{e.instructions}</Text>
            )}
            {e.mode !== "cardio" && exerciseTargetsText(e.targets, plan.effortScale) ? <Text style={styles.muted}>Target: {exerciseTargetsText(e.targets, plan.effortScale)}</Text> : null}
            {e.sets.map((s, j) => (
              <Text key={j} style={styles.modalText}>
                {s.setType === "warmup" ? "W" : ++working}
                {s.setType === "drop"
                  ? " D"
                  : s.setType === "failure"
                    ? " F"
                    : ""}{" "}
                ·{" "}
                {e.mode === "cardio"
                  ? `${Math.round(((s.durationSec || 0) / 60) * 100) / 100} min${s.distanceKm == null ? "" : ` · ${Math.round((e.unit === "mi" ? s.distanceKm / 1.60934 : s.distanceKm) * 100) / 100} ${e.unit}`}`
                  : `${s.weightKg == null ? "" : `${Math.round(s.weightKg * (e.unit === "lbs" ? 2.20462 : 1) * 10) / 10} ${e.unit} × `}${s.reps} reps`}
                {s.targetRpe == null
                  ? ""
                  : ` · Target ${plan.effortScale.toUpperCase()} ${rpeToEffort(s.targetRpe, plan.effortScale)}`}
              </Text>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SharingButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  busy,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  busy: boolean;
}) {
  const styles = useNotebookStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        primary ? styles.primaryButton : styles.secondaryButton,
        (busy || disabled) && styles.disabled,
      ]}
    >
      <Text style={primary ? styles.primaryText : styles.secondaryText}>
        {label}
      </Text>
    </Pressable>
  );
}
