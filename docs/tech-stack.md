# 🧱 LastRep Tech Stack Decision Document

**Date:** October 2025  
**Stage:** Sprint 1 — Foundation  

---

## 🔭 Overview

LastRep is a mobile fitness app focused on **integrity, self-improvement, and holistic training**.  
The MVP centers on **workout logging, progress tracking, and a lightweight AI coach** — built to be fast, stable, and easy to iterate.

This document records the selected **technology stack** for the MVP and the rationale behind each decision.

---

## 🖥️ Front-End

| Category | Technology | Rationale |
|-----------|-------------|-----------|
| **Framework** | React Native (Expo) | Enables cross-platform development (iOS + Android) with minimal setup and strong community support. |
| **Language** | TypeScript | Adds type safety and scalability for future contributors. |
| **Styling** | Tailwind CSS (via NativeWind) | Utility-first styling for rapid prototyping. |
| **UI Components** | shadcn/ui | Provides a consistent, modern UI base. |
| **Animations** | Framer Motion | Smooth, physics-based motion for a premium feel. |
| **Charts** | Recharts | For weekly progress summaries and analytics visualizations. |

---

## ☁️ Back-End & Database

| Feature | Tool | Reason |
|----------|------|--------|
| **Auth** | Firebase Authentication | Simple, secure, and ready for email + Google/Apple sign-in. |
| **Database** | Firestore (NoSQL) | Fast, scalable, and flexible for dynamic workout logs. |
| **Functions** | Firebase Cloud Functions | Powers AI Coach API calls and custom logic. |
| **Storage** | Firebase Storage | Optional for user uploads or exports. |
| **Analytics** | Firebase Analytics + Crashlytics | Built-in insights and error tracking. |

---

### 🧩 Rationale

- Seamless integration with Expo and TypeScript.  
- Excellent **offline support**, crucial for workouts in low-connectivity environments.  
- Minimal DevOps overhead — focus on **UX and feature velocity**.  
- Easily scalable for MVP and early-stage growth.

---

### ⚠️ Known Limitations

- NoSQL (Firestore) is **less ideal for relational queries**.  
- A future migration to SQL (e.g., Supabase/Postgres) may be needed for complex data models.

---

## 🧭 Future Considerations

| Area | Possible Upgrade | Reason |
|-------|------------------|--------|
| **Database** | Supabase / Postgres | For advanced analytics and relational structures (e.g., exercises, programs). |
| **API Layer** | Express or Next.js Routes | To decouple AI logic from Firebase Functions. |
| **Analytics** | Mixpanel or Amplitude | For deeper engagement and behavior tracking. |

---

## 📁 Repository Structure (Initial)

```plaintext
/lastrep
├── /docs
│   ├── architecture.md
│   └── tech-stack.md
│
├── /lastrep-app
│   ├── /src
│   │   ├── /components
│   │   ├── /screens
│   │   ├── /services
│   │   └── /utils
│   ├── app.json
│   ├── package.json
│   └── firebaseConfig.ts