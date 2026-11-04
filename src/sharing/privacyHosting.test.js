import {describe,expect,it} from "vitest";
import fs from "node:fs";
import {createRequire} from "node:module";
const {renderPrivacyMarkdown,renderDeletionMarkdown}=createRequire(import.meta.url)("../../scripts/prepare-sharing-hosting.js");
describe("hosted privacy policy",()=>{
 it("publishes the canonical policy exactly from its Markdown source",()=>{
   const source=fs.readFileSync("doc/privacy.md","utf8");
   expect(fs.readFileSync("hosting/workout-sharing/privacy/index.html","utf8").replaceAll("\r\n","\n")).toBe(renderPrivacyMarkdown(source));
   expect(renderPrivacyMarkdown(source)).toContain("https://lastrep.web.app/privacy");
 });
 it("publishes the migrated deletion policy and distinct email request actions",()=>{
   const source=fs.readFileSync("doc/account-and-data-deletion.md","utf8");
   const html=renderDeletionMarkdown(source);
   expect(fs.readFileSync("hosting/workout-sharing/data-deletion/index.html","utf8").replaceAll("\r\n","\n")).toBe(html);
   expect(html).toContain('href="mailto:lastrep.dev@gmail.com?subject=Account%20Deletion%20Request"');
   expect(html).toContain('href="mailto:lastrep.dev@gmail.com?subject=Data%20Deletion%20Request"');
   expect(html).toContain('https://lastrep.web.app/data-deletion');
   expect((html.match(/<h2>/g)||[]).length).toBe(6);
   expect(html).toContain('data-copy-request="account"');
   expect(html).toContain('data-copy-request="data"');
   expect(html).toContain('src="/legal.mjs"');
   expect(html).toContain('These buttons open an email draft');
 });
 it("escapes raw HTML while rendering headings, paragraphs, bold text and lists",()=>{
   const html=renderPrivacyMarkdown('# Policy\n\n**Date:** today\n\n- <script>unsafe</script>\n- Second item');
   expect(html).toContain('<h1>Policy</h1>');
   expect(html).toContain('<strong>Date:</strong> today');
   expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
   expect(html).not.toContain('<script>unsafe');
 });
});
