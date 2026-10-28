import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const source = readFileSync("app/(tabs)/profile/index.tsx", "utf8");
it("uses notebook surfaces and focused section drafts rather than legacy goal/meal controls", () => {
  expect(source).toContain("<NotebookProvider><ProfileContent /></NotebookProvider>");
  expect(source).toContain('cancelProfileSection(buildSnapshot(), editor.before, editor.section)');
  expect(source).toContain('validateProfileEditor(editor.section, buildSnapshot(), editor.before)');
  expect(source).not.toContain("MealPreferencesCard");
  expect(source).not.toContain('title="Goal"');
  expect(source).toContain('disabled={loading || savingProfile || !hasUnsavedChanges || initialSnapshot == null}');
});
it("preserves native save/leave, consent, cloud-photo and live target contracts", () => {
  for (const contract of ["setProfileLeaveGuard", "stageProfilePhoto", "commitProfilePhoto", "discardProfilePhotoUpload", "reconcileSleepTargetDraft", "handleManageHealthPermissions", "handleAcceptHealthConsent", "saveUserPhases", "saveManualBodyCompositionEntry"]) expect(source).toContain(contract);
  expect(source).toContain('buttonLayout: "vertical"');
  expect(source).toContain('text: "Save and leave"');
  expect(source).toContain('text: "Discard and leave"');
  expect(source).toContain('text: "Keep editing"');
});

it("keeps Sync now in Profile when permissions are missing", () => {
  const sync = source.slice(source.indexOf("const handleSyncHealthConnectData ="), source.indexOf("const save ="));
  expect(sync).not.toContain("openHealthConnectAppPermissionsScreen");
  expect(sync).not.toContain("openHealthConnectDataManagementScreen");
  expect(sync).not.toContain("requestPermission");
  expect(sync).toContain("Use Health Connect permissions to review access, then try again.");
  const denied = sync.slice(sync.indexOf("if (!sleepGranted && !samsungBodyGranted && !healthConnectBodyGrantedNext && !stepsGranted)"), sync.indexOf("const [sleepResult, bodyResult, stepsResult]"));
  expect(denied).toContain("await refreshHealthConnectStatus();");
  expect(denied).toContain("return;");
});

it("uses one permissions action for requests and settings recovery without automatic navigation after cancellation", () => {
  expect(source).not.toContain('label="Open Health Connect settings"');
  const handler = source.slice(source.indexOf("const handleManageHealthPermissions ="), source.indexOf("const handleDisconnectHealth ="));
  expect(handler).toContain("if (reviewHealthAccessInSettings)");
  expect(handler).toContain("await openHealthConnectAppPermissionsScreen()");
  expect(handler).toContain('if (result === "incomplete")');
  expect(handler).toContain("setReviewHealthAccessInSettings(true)");
  expect(handler).toContain("tap Health Connect permissions again to review access");
});

it("uses one connectivity-driven offline save notice without leaving stale save feedback", () => {
  const save = source.slice(source.indexOf("const save ="), source.indexOf("const navigateBack"));
  expect(save).toContain("if (isOffline) return false;");
  expect(save.indexOf("if (isOffline) return false;")).toBeLessThan(save.indexOf("setSaveFeedback(null)"));
  expect(source).not.toContain("Reconnect before saving; your edits are kept.");
  expect(source).toContain('Offline. Your edits stay here; reconnect before saving.</Text> : saveFeedback && saveFeedback !== "Changes saved." && !savingProfile ?');
  const banner = readFileSync("components/OfflineBanner.tsx", "utf8");
  expect(banner).toContain('if (!ready || !isOffline || dismissed)');
  expect(banner).not.toContain('pathname');
  expect(banner).toContain('onPress={() => setDismissed(true)}');
});

it("handles offline cold starts without accepting defaults or overwriting an existing draft on reconnect", () => {
  expect(source).toContain("if (loadedProfileUidRef.current === user.uid) return;");
  expect(source).toContain("if (!networkReady || isOffline)");
  expect(source).toContain("if (!loading && !profileLoadFailed && initialSnapshot == null)");
  expect(source).toContain("cancelled || auth.currentUser?.uid !== user.uid");
  expect(source).toContain("profileLoadFailed ? <View");
  expect(source).toContain("Your saved profile has not loaded.");
  expect(source).toContain("scheduleAfterInteractions(() => runProfileRefresh(async () =>");
  expect(source).toContain("{ includeMetadataChanges: true }");
  expect(source).toContain("shouldRetryProfileLoad(loadedProfileUidRef.current, uid, initialSnapshotRef.current != null, snap.metadata.fromCache)");
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  expect(home).toContain('profileDataLoaded ? userNickname ?? "Lifter" : "Profile not loaded"');
  expect(home).toContain('if (!data) return; // An empty offline cache');
  expect(home).toContain('{profileDataLoaded ? <View style={[styles.entitlementBadge');
});

it("describes an unchanged sleep import without implying saved history is absent", () => {
  expect(source).toContain('messages.push("No new sleep data found.")');
  expect(source).not.toContain('messages.push("No sleep data found.")');
});

it("skips unchanged preference writes and uses the fast photo path only for photo-only drafts", () => {
  expect(source).toContain("profileSaveSections(buildSnapshot(), initialSnapshot)");
  expect(source).toContain("const savedPhases = sectionsToSave.profile");
  expect(source).toContain("if (sectionsToSave.sleep) await setDoc(");
  expect(source).toContain("if (sectionsToSave.nutrition) await saveNutritionProfile(");
  expect(source).toContain("if (sectionsToSave.photoOnly)");
  expect(source).toContain("await saveProfilePhotoOnly(uid, profilePhotoUri)");
  expect(source).toContain("if (needsPhotoCommit && !photoCommitted)");
  expect(source).not.toContain("profile_save_timing");
});
it("adds lean mass to load, unit conversion, snapshots and save without reusing muscle mass", () => {
  for (const contract of ["leanMass: leanMass.trim()", "setLeanMass(formatWeightForUnit(effective.leanBodyMassKg, unit))", "setLeanMass((previous) => convertText(previous))", "bodyCompositionUpdates.leanBodyMassKg = nextLeanMassKg"]) expect(source).toContain(contract);
});
it("connects wrapped fields to the modal's keyboard focus tracking", () => {
  const controls = readFileSync("src/profile/ProfileNotebookControls.tsx", "utf8");
  const modal = readFileSync("src/ui/AdaptiveModalCard.tsx", "utf8");
  expect(controls).toContain("useContext(ModalInputFocusContext)");
  expect(controls).toContain("registerFocus?.()");
  expect(controls).toContain("selectTextOnFocus={selectOnFocus} disableFullscreenUI");
  expect(controls).toContain("setSelectOnFocus(false)");
  expect(controls).toContain("onShow={() => setReady(true)}");
  expect(modal).toContain("<ModalInputFocusContext.Provider");
  expect(controls).toContain('onRequestClose={onClose}');
  expect(controls).toContain('onDismiss={onClose}');
});

it("keeps Profile focus scrolling minimal and opts into motion only when permitted", () => {
  const controls = readFileSync("src/profile/ProfileNotebookControls.tsx", "utf8");
  const modal = readFileSync("src/ui/AdaptiveModalCard.tsx", "utf8");
  expect(controls).toContain('focusPlacement="visible" animateFocus');
  expect(modal).toContain("animated: animateFocus && !reducedMotion");
  expect(modal).toContain('AccessibilityInfo.addEventListener("reduceMotionChanged"');
  expect(controls).not.toContain("numberOfLines=");
});

it("keeps identity, phase explanations and all four unit groups in their reviewed order", () => {
  const identity = source.slice(source.indexOf('<ProfileSection first title="Identity"'), source.indexOf('<ProfileSection title="Training"'));
  expect(identity.indexOf('nickname.trim() || "Your profile"')).toBeLessThan(identity.indexOf('entitlement.state === "loading"'));
  expect(identity.indexOf('entitlement.state === "loading"')).toBeLessThan(identity.indexOf("{profileDescription ?"));
  for (const label of ["Exercise effort", "Weight", "Height", "Food energy"]) {
    expect(source).toContain(`<ProfileChoices equalCells label="${label}"`);
  }
  expect(source).toContain("<PhaseEditor");
  expect(source).toContain("current={phaseData} staged");
});

it("reveals sync feedback after content layout without following unrelated later updates", () => {
  expect(source).toContain('onContentSizeChange={revealHealthFeedback}');
  expect(source).toContain('accessibilityLiveRegion="polite" onLayout={revealHealthFeedback}');
  expect(source).toContain('pendingHealthFeedbackRef.current = !!healthFeedback');
  expect(source).toContain('if (!pendingHealthFeedbackRef.current) return;');
  expect(source).toContain('pendingHealthFeedbackRef.current = false;');
  expect(source).toContain('cancelAnimationFrame(feedbackFrameRef.current)');
});

it("shares the same accessible information control on Home and Profile", () => {
  const info = readFileSync("src/ui/notebook/NotebookInfoButton.tsx", "utf8");
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  const controls = readFileSync("src/profile/ProfileNotebookControls.tsx", "utf8");
  expect(info).toContain('accessibilityRole="button" accessibilityLabel={label} onPress={onPress}');
  expect(info).toContain('name="information-circle-outline" size={16}');
  expect(info).toContain('width: 44, minHeight: 44');
  expect(controls).toContain('<NotebookInfoButton label={`About ${label}`} onPress={help}');
  for (const label of ["About recovery readiness", "About weekly trends"]) {
    expect(home).toContain(`<NotebookInfoButton label="${label}"`);
  }
});

it("rounds detached Workout cards at the bottom as well as the top", () => {
  for (const path of ["src/workouts/workoutLog/WorkoutTodayPlan.tsx", "src/workouts/workoutLog/AvailableWeightsModal.tsx", "src/workouts/workoutLog/workoutLogStyles.ts"]) {
    const workout = readFileSync(path, "utf8");
    expect(workout).not.toContain("borderTopLeftRadius:");
    expect(workout).not.toContain("borderTopRightRadius:");
    expect(workout).toMatch(/(?:sheet|modalCard): \{[^}]*borderRadius: (?:16|24)/);
  }
});
