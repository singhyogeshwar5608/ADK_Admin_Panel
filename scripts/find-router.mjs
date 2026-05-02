import fs from "fs";
const c = fs.readFileSync("c:/Users/dell/Downloads/adk_admin/assets/index-cdraepgx.js", "utf8");
const markers = [
  "createBrowserRouter",
  "createHashRouter",
  "RouterProvider",
  "createRoutesFromElements",
  "BrowserRouter",
  "Routes",
  "Route",
];
for (const m of markers) {
  const i = c.indexOf(m);
  console.log(m, i >= 0 ? i : "NOT FOUND");
  if (i >= 0) console.log(c.slice(i, i + 600), "\n---\n");
}
