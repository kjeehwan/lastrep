import {describe,expect,it} from "vitest";
import fs from "node:fs";
import {createRequire} from "node:module";
const {renderPrivacyMarkdown}=createRequire(import.meta.url)("../../scripts/prepare-sharing-hosting.js");
describe("hosted privacy policy",()=>{
 it("publishes the canonical policy exactly from its Markdown source",()=>{
   const source=fs.readFileSync("doc/privacy.md","utf8");
   expect(fs.readFileSync("hosting/workout-sharing/privacy/index.html","utf8").replaceAll("\r\n","\n")).toBe(renderPrivacyMarkdown(source));
   expect(renderPrivacyMarkdown(source)).toContain("https://lastrep.web.app/privacy");
 });
 it("escapes raw HTML while rendering headings, paragraphs, bold text and lists",()=>{
   const html=renderPrivacyMarkdown('# Policy\n\n**Date:** today\n\n- <script>unsafe</script>\n- Second item');
   expect(html).toContain('<h1>Policy</h1>');
   expect(html).toContain('<strong>Date:</strong> today');
   expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
   expect(html).not.toContain('<script>unsafe');
 });
});
