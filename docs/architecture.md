# 🏗️ LastRep System Architecture

**Date:** October 2025  
**Stage:** Sprint 1 — Foundation

---

## 🧭 Overview

LastRep is a **React Native (Expo)** mobile app connected to a **Firebase backend** for authentication, data storage, and analytics.  
An optional **AI Coach** service extends Firebase Functions to deliver personalized workout feedback and suggestions.

---

## 🧩 Architecture Diagram (Conceptual)

┌─────────────────────────────┐
│ User Device │
│─────────────────────────────│
│ React Native (Expo) App │
│ ├── UI: shadcn/ui, Tailwind │
│ ├── Charts: Recharts │
│ ├── Animations: Framer │
│ ├── Offline cache (Firestore SDK) │
└────────────┬────────────────┘
│
▼
┌─────────────────────────────┐
│ Firebase │
│─────────────────────────────│
│ Auth — Email/Google/Apple │
│ Firestore — Workout Logs │
│ Functions — AI Coach Calls │
│ Storage — Optional uploads │
│ Analytics — Usage metrics │
└────────────┬────────────────┘
│
▼
┌─────────────────────────────┐
│ AI Coach Layer │
│─────────────────────────────│
│ Hosted via Firebase Function│
│ → Calls external API │
│ → Returns suggestions, next │
│ workout plans, feedback │
└────────────┬────────────────┘
│
▼
┌─────────────────────────────┐
│ External APIs │
│─────────────────────────────│
│ OpenAI or Local Model API │
│ (abstracted behind function)│
└─────────────────────────────┘

## ⚙️ Data Flow Summary

### **User Authentication**
- App authenticates via Firebase Auth (email/password → Google/Apple later).  
- User token grants access to Firestore & Functions.

### **Workout Logging**
- App writes workouts locally → syncs to Firestore (offline caching).  
- Each document includes `userId`, `timestamp`, `exercise`, `sets`, `reps`, and `weight`.

### **Progress Tracking**
- Weekly summaries computed locally or fetched from Firestore aggregates.  
- Visualized with Recharts in the Home/Progress tabs.

### **AI Coach Interaction**
- User sends query → triggers Firebase Function.  
- Function calls AI endpoint (OpenAI or custom script).  
- Response returned → displayed in AI Coach chat UI.

### **Analytics & Crash Reporting**
- Firebase Analytics captures engagement metrics.  
- Crashlytics logs runtime errors for debugging.

---

## 🧠 Key Design Principles

| Principle | Description |
|------------|-------------|
| Offline-first | Firestore local persistence ensures workout logging works without connectivity. |
| Serverless simplicity | Firebase Functions replace complex backend servers. |
| Modular architecture | Each feature (logging, AI, summary) is independent and replaceable. |
| Scalable structure | Can migrate to Supabase/Postgres or custom API later without rewriting the app core. |

---

## 🚀 Future Extensions

| Area | Description |
|------|--------------|
| Nutrition Logging (v1.1) | Add new Firestore collection + charts for calories/macros. |
| Social / Community (v2.0) | Introduce user interactions, leaderboards, shared workouts. |
| AI Coach Expansion | Replace simple script API with full training/nutrition agent. |
| Advanced Analytics | Sync Firestore data into BigQuery for deeper insights or ML models. |