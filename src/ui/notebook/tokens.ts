export const notebookPaper = {
  canvas: "#F6F2E9", surface: "#FFFCF5", subtle: "#ECE7DC",
  ink: "#242720", muted: "#625F55", rule: "#D8D1C3", border: "#817B6E",
  accent: "#A33F24", accentSoft: "#F3E4D8", primary: "#242720", onPrimary: "#FFFCF5",
  danger: "#A12E2B", success: "#3E6248", warning: "#795000", overlay: "rgba(0,0,0,0.4)",
};
export type NotebookColors = typeof notebookPaper;
export const notebookDark: NotebookColors = {
  canvas: "#191A18", surface: "#242521", subtle: "#2D2E29",
  ink: "#F3F0E6", muted: "#BBB7AC", rule: "#41433A", border: "#8E9083",
  accent: "#F2A07D", accentSoft: "#3B2D25", primary: "#F3F0E6", onPrimary: "#191A18",
  danger: "#FFAAA2", success: "#A6C6A6", warning: "#E8C376", overlay: "rgba(0,0,0,0.6)",
};
export const notebookFonts = { body: "NotebookSans", semibold: "NotebookSansSemibold", editorial: "NotebookSerif" };
export const notebookGeometry = { inset: 20, contentWidth: 760, icon: 20, headerIcon: 22, target: 48, headerTarget: 44 };
export function notebookRowHeight(fontScale: number) { return fontScale >= 1.5 ? Math.ceil(340 * Math.min(fontScale, 3) / 2) : Math.ceil(52 * Math.max(1, fontScale)); }
