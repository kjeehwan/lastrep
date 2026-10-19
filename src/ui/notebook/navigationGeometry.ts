export function usesNotebookDesign(pathname: string): boolean {
  return pathname === "/auth/sign-in" || pathname === "/auth/sign-up" || pathname === "/home" || ["/workout", "/nutrition", "/sleep", "/profile", "/settings"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function notebookTabBarHeight(bottomInset: number, fontScale: number): number {
  return (fontScale >= 1.5 ? 40 + 28 * fontScale : 60) + Math.max(bottomInset, 12) + 8;
}

export function notebookDialogTabHeight(pathname: string, bottomInset: number, fontScale: number): number | undefined {
  return usesNotebookDesign(pathname) && !pathname.startsWith("/auth/") ? notebookTabBarHeight(bottomInset, fontScale) : undefined;
}
