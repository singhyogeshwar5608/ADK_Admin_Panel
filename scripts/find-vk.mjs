import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
const i = c.indexOf("netshop_access_token");
console.log(c.slice(i - 120, i + 400));
