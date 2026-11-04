/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const inline = (text) => escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replaceAll("lastrep.dev@gmail.com", '<a href="mailto:lastrep.dev@gmail.com">lastrep.dev@gmail.com</a>');
function renderLegalMarkdown(markdown, {title, route, deletionActions = false}) {
  const lines = markdown.replaceAll("\r\n", "\n").trim().split("\n");
  let output = [], paragraph = [], list = false;
  const flush = () => { if (paragraph.length) { output.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; } };
  const closeList = () => { if (list) { output.push("</ul>"); list = false; } };
  for (const line of lines) {
    const heading = /^(#{1,2}) (.+)$/.exec(line);
    if (heading) { flush(); closeList(); const tag = `h${heading[1].length}`; output.push(`<${tag}>${inline(heading[2])}</${tag}>`); }
    else if (line.startsWith("- ")) { flush(); if (!list) { output.push("<ul>"); list = true; } output.push(`<li>${inline(line.slice(2))}</li>`); }
    else if (!line.trim()) { flush(); closeList(); }
    else { closeList(); paragraph.push(line.trim()); }
  }
  flush(); closeList();
  let content = output.join("\n");
  if (deletionActions) content = content.replace('<h2>', '<nav aria-label="Deletion requests"><a class="button button-secondary" href="mailto:lastrep.dev@gmail.com?subject=Account%20Deletion%20Request">Request account deletion</a><a class="button button-secondary" href="mailto:lastrep.dev@gmail.com?subject=Data%20Deletion%20Request">Request selected data deletion</a></nav><h2>');
  const footer = deletionActions ? '<a href="/privacy">Privacy policy</a>' : '<a href="/data-deletion">Account and data deletion</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escape(title)} · Lastrep</title><link rel="canonical" href="https://lastrep.web.app${escape(route)}"><link rel="stylesheet" href="/sharing.css"></head><body><main><header><img src="/wordmark.svg" alt="Lastrep" width="144" height="48"></header><div class="policy">${content}</div><footer>${footer}</footer></main></body></html>\n`;
}
const renderPrivacyMarkdown = markdown => renderLegalMarkdown(markdown, {title:"Privacy policy", route:"/privacy"});
const renderDeletionMarkdown = markdown => renderLegalMarkdown(markdown, {title:"Account and data deletion", route:"/data-deletion", deletionActions:true});
function prepare() {
  const hosting = path.join(root, "hosting/workout-sharing");
  fs.mkdirSync(path.join(hosting, "privacy"), {recursive: true});
  fs.writeFileSync(path.join(hosting, "privacy/index.html"), renderPrivacyMarkdown(fs.readFileSync(path.join(root, "doc/privacy.md"), "utf8")));
  fs.mkdirSync(path.join(hosting, "data-deletion"), {recursive:true});
  fs.writeFileSync(path.join(hosting, "data-deletion/index.html"), renderDeletionMarkdown(fs.readFileSync(path.join(root,"doc/account-and-data-deletion.md"),"utf8")));
  fs.mkdirSync(path.join(hosting, "fonts"), {recursive: true});
  for (const name of ["source-sans-3.ttf", "source-sans-3-semibold.ttf", "source-serif-4.ttf", "source-sans-3-LICENSE.txt", "source-serif-4-LICENSE.txt"])
    fs.copyFileSync(path.join(root, "assets/fonts", name), path.join(hosting, "fonts", name));
  fs.copyFileSync(path.join(root, "assets/images/logo-splash-512-appicon-v3.png"), path.join(hosting, "app-icon.png"));
}
module.exports = {renderPrivacyMarkdown, renderDeletionMarkdown, prepare};
if (require.main === module) prepare();
