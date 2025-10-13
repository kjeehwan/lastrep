🧱 LastRep Tech Stack Decision Document

Date: October 2025
Stage: Sprint 1 — Foundation

🔭 Overview

LastRep is a mobile fitness app focused on integrity, self-improvement, and holistic training.
The MVP centers on workout logging, progress tracking, and a lightweight AI coach — built to be fast, stable, and easy to iterate.

This document records the selected technology stack for the MVP and the rationale behind each decision.

🖥️ Front-End

Framework: React Native (Expo)

Enables cross-platform development (iOS + Android) with minimal configuration.

Excellent community support and rapid iteration speed.

Language: TypeScript

Adds type safety and improves scalability for future contributors.

UI & Styling:

Tailwind CSS (via NativeWind) → utility-first styling for fast prototyping.

shadcn/ui → consistent, modern UI components.

Framer Motion → smooth, physics-based animations.

Recharts → charts for weekly progress summaries.

☁️ Back-End & Database

Chosen Platform: Firebase

Feature	Tool	Reason
Auth	Firebase Authentication	Simple, secure, ready for email + Google/Apple.
Database	Firestore (NoSQL)	Fast, scalable, perfect for flexible workout logs.
Functions	Firebase Cloud Functions	Used for AI Coach API calls and custom logic.
Storage	Firebase Storage	Optional for user photos or data exports.
Analytics	Firebase Analytics + Crashlytics	Built-in app insights and error tracking.

Rationale:

Seamless integration with Expo.

Excellent offline support — critical for workout logging in low-connectivity areas.

Minimal DevOps overhead; allows focus on UX and core logic.

Scales adequately for MVP and early growth.

Known Limitations:

NoSQL structure less ideal for complex relational queries.

Migrating to SQL (e.g., Supabase/Postgres) may be required in later versions.

🧩 Future Considerations
Area	Possible Upgrade	Reason
Database	Supabase / Postgres	For advanced analytics and relational models (programs, exercises).
API Layer	Express or Next.js API routes	To decouple AI logic from Firebase Functions.
Analytics	Mixpanel or Amplitude	For deeper user engagement metrics.
📁 Repository Structure (Initial)
/lastrep-app
  /src
    /components
    /screens
    /services
    /utils
  app.json
  package.json
  firebaseConfig.ts
/docs
  tech-stack.md
  architecture.md (future)

✅ Next Action Items

Initialize Firebase project.

Connect Firebase SDK to Expo app.

Implement test flow:

Email/password sign-up

Add & retrieve sample “workout log”

Verify offline → online sync behavior.