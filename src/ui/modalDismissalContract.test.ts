import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

it("every application popup supplies an Android Back dismissal handler", () => {
  const missing: string[] = [];
  let checked = 0;
  for (const path of ["app", "src", "components"].flatMap(tsxFiles)) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = node.tagName.getText(source);
        if (["Modal", "NotebookModal", "WorkoutModalShell"].includes(name)) {
          checked++;
          const hasHandler = node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "onRequestClose");
          // This single wrapper forwards a required, type-checked handler to native Modal.
          const forwardsRequiredProps = path.replaceAll("\\", "/") === "src/ui/notebook/NotebookModal.tsx" && node.attributes.properties.some(ts.isJsxSpreadAttribute);
          if (!hasHandler && !forwardsRequiredProps) {
            missing.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(checked).toBeGreaterThan(30);
  expect(missing).toEqual([]);
});
