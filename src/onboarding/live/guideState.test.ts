import { describe, expect, it } from "vitest";
import { emptyGuide, guideReducer, guideTopics, guideTopicOnPath } from "./guideState";
describe("real-use guide session", () => {
  it("keeps the chosen topic when the user visits another tab", () => {
    let s = guideReducer(emptyGuide(), { type: "start", owner: "a", topic: "programs" });
    s = guideReducer(s, { type: "dismiss", owner: "a", id: "program-entry" });
    s = guideReducer(s, { type: "route", owner: "a", path: "/profile" });
    expect(s.topic).toBe("programs");
    s = guideReducer(s, { type: "route", owner: "a", path: "/workout/log" });
    expect(s.topic).toBe("programs"); expect(s.dismissed).toContain("program-entry");
    expect(guideReducer(emptyGuide(), { type: "route", owner: "a", path: "/sleep" }).topic).toBeNull();
  });
  it("rejects late completion/dismissal from a previous account", () => {
    let s = guideReducer(emptyGuide(), { type: "start", owner: "a", topic: "workout" });
    s = guideReducer(s, { type: "start", owner: "b", topic: "profile" });
    expect(guideReducer(s, { type: "event", owner: "a", id: "saved" })).toBe(s);
    expect(guideReducer(s, { type: "dismiss", owner: "a", id: "profile" })).toBe(s);
  });
  it("replay restores dismissed tips but keeps successful actions within the same session", () => {
    let s = guideReducer(emptyGuide(), { type: "start", owner: "a", topic: "workout" });
    s = guideReducer(s, { type: "event", owner: "a", id: "saved" });
    s = guideReducer(s, { type: "dismiss", owner: "a", id: "finish" });
    s = guideReducer(s, { type: "start", owner: "a", topic: "workout" });
    expect(s.dismissed).toEqual([]); expect(s.events).toEqual(["saved"]);
    expect(guideReducer(s, { type: "end" })).toEqual(emptyGuide());
  });
});

it("dismissing Sleep does not select Nutrition or end the guide", () => {
  let state=guideReducer(emptyGuide(),{type:"start",owner:"a",topic:"sleep"});
  state=guideReducer(state,{type:"dismiss",owner:"a",id:"sleep-overview"});
  state=guideReducer(state,{type:"route",owner:"a",path:"/nutrition"});
  expect(state.topic).toBe("sleep");
  expect(guideTopicOnPath(state.topic!,"/nutrition","nutrition-diary")).toBe(false);
  expect(state.dismissed).toEqual(["sleep-overview"]);
  state=guideReducer(state,{type:"end"});
  expect(guideReducer(state,{type:"route",owner:"a",path:"/sleep"}).topic).toBeNull();
});

it("keeps a topic within its real feature, with explicit workout completion and Sharing exceptions", () => {
  expect(guideTopicOnPath("workout","/sleep","sleep-overview")).toBe(false);
  expect(guideTopicOnPath("nutrition","/nutrition/meal/search","nutrition-search")).toBe(true);
  expect(guideTopicOnPath("plan","/workout/log","plan-review")).toBe(true);
  expect(guideTopicOnPath("workout","/home","workout-complete")).toBe(true);
  expect(guideTopicOnPath("workout","/home","workout-record")).toBe(false);
  expect(guideTopicOnPath("sharing","/home","receive-program")).toBe(true);
});

it("begins with an active chooser and no silently selected topic", () => {
  let state=guideReducer(emptyGuide(),{type:"begin",owner:"a"});
  expect(state).toMatchObject({active:true,owner:"a",topic:null});
  state=guideReducer(state,{type:"route",owner:"a",path:"/nutrition"});
  expect(state.topic).toBeNull();
  state=guideReducer(state,{type:"start",owner:"a",topic:"nutrition"});
  expect(state.topic).toBe("nutrition");
  expect(guideReducer(state,{type:"end"}).active).toBe(false);
  expect(guideReducer(state,{type:"begin",owner:"b"})).toMatchObject({owner:"b",events:[],dismissed:[],topic:null});
});

it("keeps Profile setup and health access as distinct choices on the real Profile route", () => {
  expect(guideTopics.find(topic => topic.id === "profile")?.title).toBe("Set up your profile");
  expect(guideTopics.find(topic => topic.id === "health")?.route).toBe("/(tabs)/profile");
  expect(guideTopicOnPath("health", "/profile", "health-real")).toBe(true);
  expect(guideTopicOnPath("health", "/nutrition", "health-real")).toBe(false);
  let state = guideReducer(emptyGuide(), { type: "start", owner: "a", topic: "health" });
  state = guideReducer(state, { type: "start", owner: "a", topic: "profile" });
  expect(state.topic).toBe("profile");
});
