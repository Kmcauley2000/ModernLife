diff --git a/projects/modern-world-life/tests/engine.test.mjs b/projects/modern-world-life/tests/engine.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..f40612df5aa9f535f8e23ddd55a0e23ed84bab97
--- /dev/null
+++ b/projects/modern-world-life/tests/engine.test.mjs
@@ -0,0 +1,60 @@
+import assert from "node:assert/strict";
+import { GameEngine, BASE_STATE, migrateSave } from "../game.js";
+
+function run(name, fn) {
+  try {
+    fn();
+    console.log(`PASS ${name}`);
+  } catch (err) {
+    console.error(`FAIL ${name}`);
+    throw err;
+  }
+}
+
+run("network quest progresses by rep gained, not total rep", () => {
+  const g = new GameEngine(() => 0.5);
+  const q = () => g.state.quests.find(x => x.id === "network");
+
+  g.adjust({ rep: +10 }, "rep up");
+  assert.equal(q().progress, 10);
+
+  g.adjust({ cash: +20 }, "cash only");
+  assert.equal(q().progress, 10);
+
+  g.adjust({ rep: +6 }, "rep up again");
+  assert.equal(q().progress, 16);
+});
+
+run("cycle rollover increments day and applies daily tick", () => {
+  const g = new GameEngine(() => 0.5);
+  g.state.cycle = 3;
+  const startDay = g.state.day;
+  const startCash = g.state.cash;
+
+  g.advanceCycle();
+
+  assert.equal(g.state.day, startDay + 1);
+  assert.equal(g.state.cycle, 0);
+  assert.ok(g.state.cash <= startCash - 18);
+});
+
+run("save migration upgrades legacy payload", () => {
+  const legacy = { ...BASE_STATE, saveVersion: 1 };
+  delete legacy.quests;
+  const migrated = migrateSave(legacy);
+  assert.equal(migrated.saveVersion, 2);
+  assert.ok(Array.isArray(migrated.quests));
+});
+
+run("serialized save can be loaded", () => {
+  const g = new GameEngine(() => 0.5);
+  g.adjust({ cash: +123, rep: +7 }, "progress");
+
+  const blob = g.serialize();
+
+  const g2 = new GameEngine(() => 0.5);
+  g2.loadFromSerialized(blob);
+
+  assert.equal(g2.state.cash, g.state.cash);
+  assert.equal(g2.state.rep, g.state.rep);
+});
