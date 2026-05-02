import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
for (const name of ["L2=", "I2=", "A2=", "O2=", "Tk=", "c1=", "s1="]) {
  const i = c.indexOf(name);
  console.log("\n====", name, i, "====");
  if (i >= 0) console.log(c.slice(i, i + 1200));
}
