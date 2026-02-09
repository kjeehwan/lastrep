"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyDecision = void 0;
const functions = __importStar(require("firebase-functions"));
const heuristicDecision = (input) => {
    const { sleepHours, soreness, fatigue, motivation, dietPhase } = input;
    const isLowSleep = sleepHours < 6;
    const isHighFatigue = fatigue >= 7;
    const isHighSoreness = soreness >= 7;
    const isHighMotivation = motivation >= 7;
    let decision = "MAINTAIN";
    const explanation = [];
    let intensityPct;
    if (isLowSleep || isHighFatigue || isHighSoreness) {
        decision = "PULL_BACK";
        explanation.push("Recovery signals are low today.");
        if (isLowSleep)
            explanation.push("Sleep is below 6 hours.");
        if (isHighFatigue || isHighSoreness)
            explanation.push("Fatigue/soreness is elevated.");
        if (dietPhase === "Cut")
            explanation.push("Given you're in a cut, keep increases conservative.");
        intensityPct = -20;
    }
    else if (sleepHours >= 7 && fatigue <= 4 && isHighMotivation) {
        decision = "PUSH";
        explanation.push("Recovery looks solid.");
        explanation.push("Motivation is high with manageable fatigue.");
        if (dietPhase === "Cut")
            explanation.push("Given you're in a cut, keep increases conservative.");
        intensityPct = 20;
    }
    else {
        decision = "MAINTAIN";
        explanation.push("Keep a steady session today.");
        explanation.push("No strong signal to push or pull back.");
        if (dietPhase === "Cut")
            explanation.push("Given you're in a cut, keep increases conservative.");
    }
    return intensityPct === undefined
        ? { decision, explanation }
        : { decision, explanation, adjustments: { intensityPct } };
};
exports.getDailyDecision = functions
    .region("asia-northeast3")
    .https.onCall((data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data;
    return heuristicDecision(input);
});
//# sourceMappingURL=index.js.map