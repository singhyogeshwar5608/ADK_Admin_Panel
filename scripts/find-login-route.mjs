import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
const needle = 'path:"/login"';
const i = c.indexOf(needle);
console.log("index", i);
console.log(c.slice(Math.max(0, i - 400), i + 2000));
