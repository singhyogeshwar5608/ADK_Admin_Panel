import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
const i = c.indexOf("F1=");
console.log(c.slice(i, i + 800));
