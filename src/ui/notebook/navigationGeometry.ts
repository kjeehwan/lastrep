export function usesNotebookDesign(pathname: string): boolean {
  return pathname === "/home" || ["/workout", "/nutrition"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function notebookTabBarHeight(bottomInset: number, fontScale: number): number {
  return (fontScale >= 1.5 ? 40 + 28 * fontScale : 60) + Math.max(bottomInset, 12) + 8;
}
