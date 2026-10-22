import { readFile, writeFile } from "node:fs/promises";

const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const markdown = await readFile("docs/kiarafun-delivery.md", "utf8");
const inline = (value) => escape(value).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const lines = markdown.split("\n");
let content = "";
let paragraph = [];
let table = false;
const flush = () => {
  if (paragraph.length) content += `<p>${inline(paragraph.join(" "))}</p>`;
  paragraph = [];
};
for (const line of lines) {
  if (line.startsWith("|")) {
    flush();
    if (/^\|[\s:|-]+\|$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1);
    if (!table) { content += "<div class='table-wrap'><table><thead><tr>" + cells.map((cell) => `<th>${inline(cell.trim())}</th>`).join("") + "</tr></thead><tbody>"; table = true; }
    else content += "<tr>" + cells.map((cell) => `<td>${inline(cell.trim())}</td>`).join("") + "</tr>";
    continue;
  }
  if (table) { content += "</tbody></table></div>"; table = false; }
  if (!line.trim()) { flush(); continue; }
  if (line.startsWith("# ")) { flush(); content += `<h1>${inline(line.slice(2))}</h1>`; }
  else if (line.startsWith("## ")) { flush(); content += `<h2>${inline(line.slice(3))}</h2>`; }
  else if (line.startsWith("- ")) { flush(); content += `<p class="bullet">${inline(line.slice(2))}</p>`; }
  else paragraph.push(line.trim());
}
flush();
if (table) content += "</tbody></table></div>";
const images = [
  ["Before · original Explore", "generated-artifacts/kiarafun/before-explore.jpg"],
  ["After · KiaraFun desktop", "generated-artifacts/kiarafun/explore-desktop.jpg"],
  ["Create · mobile", "generated-artifacts/kiarafun/create-mobile.jpg"],
  ["Dark theme · mobile", "generated-artifacts/kiarafun/browser/explore-390-dark.jpg"],
];
let gallery = "<h2>Real browser evidence</h2><div class='gallery'>";
for (const [title, path] of images) {
  try {
    const image = await readFile(path);
    gallery += `<figure><figcaption>${escape(title)}</figcaption><img alt="${escape(title)}" src="data:image/jpeg;base64,${image.toString("base64")}"></figure>`;
  } catch {}
}
gallery += "</div>";
await writeFile("generated-artifacts/kiarafun/implementation-report.html", `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KiaraFun implementation & verification</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f9fd;color:#17253b;font:15px/1.65 system-ui,sans-serif}
main{max-width:1120px;margin:auto;padding:48px 28px 80px}.eyebrow{color:#1479db;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
h1{font-size:34px;line-height:1.2;letter-spacing:-.04em;margin:12px 0 36px}h2{margin:36px 0 12px;font-size:21px;letter-spacing:-.02em}
p{margin:10px 0;color:#33465d}code{font-size:.88em;overflow-wrap:anywhere;background:#eaf1f8;padding:1px 4px;border-radius:3px}
.bullet{padding-left:18px;position:relative}.bullet:before{content:"";position:absolute;left:1px;top:11px;width:5px;height:5px;background:#1479db;border-radius:50%}
.table-wrap{overflow:auto;border:1px solid #dce9f4;border-radius:8px;background:white}table{border-collapse:collapse;width:100%;min-width:720px;font-size:13px}
td,th{text-align:left;vertical-align:top;padding:13px 16px;border-bottom:1px solid #e4edf5}th{background:#eaf6ff;color:#17253b}tr:last-child td{border-bottom:0}
.gallery{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}figure{margin:0;background:white;padding:12px;border:1px solid #dce9f4;border-radius:8px}figcaption{font-weight:600;font-size:13px;margin-bottom:10px}img{display:block;width:100%;height:auto;border-radius:4px}
@media(max-width:640px){main{padding:28px 16px}h1{font-size:28px}.gallery{grid-template-columns:1fr}}
@media print{body{background:white}main{padding:0}table{min-width:0}.gallery{grid-template-columns:1fr 1fr}figure{break-inside:avoid}}
</style><main><div class="eyebrow">KiaraFun · 22 October 2026</div>${content}${gallery}</main></html>`);
console.log("Generated self-contained KiaraFun implementation report.");
