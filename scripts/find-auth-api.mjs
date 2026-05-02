import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
for (const name of ["Ck=", "Ek=", "Pk=", "Ds=", "Nk=", "Ds.setTokens"]) {
  const i = c.indexOf(name === "Ds.setTokens" ? "setTokens" : name);
  console.log(name, i);
  if (i >= 0) console.log(c.slice(i, i + 900), "\n---\n");
}
