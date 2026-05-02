import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
const re = /pe\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]/g;
const set = new Set();
let m;
while ((m = re.exec(c))) set.add(`${m[1].toUpperCase()} ${m[2]}`);
console.log([...set].sort().join("\n"));
