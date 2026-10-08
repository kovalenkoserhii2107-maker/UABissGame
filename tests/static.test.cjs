const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
test("all JavaScript files parse", () => {
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith(".js"))
        assert.doesNotThrow(
          () =>
            new vm.Script(fs.readFileSync(file, "utf8"), { filename: file }),
        );
    }
  }
  visit(path.join(root, "js"));
});
test("inline scripts parse", () => {
  for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
    assert.doesNotThrow(() => new vm.Script(m[1]));
});
test("script dependencies are local and present", () => {
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
    assert.ok(!/^https?:/.test(m[1]));
    assert.ok(fs.existsSync(path.join(root, m[1])), m[1]);
  }
});
