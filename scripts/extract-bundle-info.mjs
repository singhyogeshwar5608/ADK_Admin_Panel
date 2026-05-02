import fs from "fs";

const path = "c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js";
const c = fs.readFileSync(path, "utf8");

const patterns = [
  [/path:"([^"]+)"/g, "path double"],
  [/path:'([^']+)'/g, "path single"],
  [/"(\/[a-zA-Z0-9_\-/:]+)"/g, "slash string"],
  [/to:"(\/[^"]+)"/g, "to Link"],
  [/children:"([^"]{3,80})"/g, "children text"],
];

for (const [re, label] of patterns) {
  const set = new Set();
  let m;
  while ((m = re.exec(c))) set.add(m[1]);
  const arr = [...set].sort();
  if (arr.length) {
    console.log("\n===", label, "(", arr.length, ") ===");
    console.log(arr.slice(0, 200).join("\n"));
  }
}

// API-ish strings
const api = new Set();
const reApi = /"(https?:\/\/[^"]{10,120})"/g;
let ma;
while ((ma = reApi.exec(c))) api.add(ma[1]);
console.log("\n=== URLs ===\n", [...api].sort().join("\n"));

// razorpay, admin, etc keywords
// All pe.get/post/put/patch/delete("/...")
const apiCalls = new Set();
const rePe = /pe\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
let mp;
while ((mp = rePe.exec(c))) apiCalls.add(`${mp[1].toUpperCase()} ${mp[2]}`);
console.log("\n=== axios pe.* calls ===\n", [...apiCalls].sort().join("\n"));

const keys = ["razorpay", "login", "logout", "token", "Bearer", "admin", "partner", "order", "product", "dashboard", "settings", "api/", "/api", "Ep=", "Rk="];
console.log("\n=== keyword line samples ===");
for (const k of keys) {
  const i = c.indexOf(k);
  if (i >= 0) {
    const slice = c.slice(Math.max(0, i - 40), Math.min(c.length, i + 120));
    console.log("\n--", k, "--\n", slice.replace(/\n/g, "\\n"));
  }
}
