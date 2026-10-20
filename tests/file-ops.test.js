"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  copyFiles,
  moveFiles,
  renameFile,
  createFolder,
  _internals,
} = require("../file-ops");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ghost-files-test-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const target = path.join(root, "target");
  await fs.mkdir(source);
  await fs.mkdir(target);
  return { root, source, target };
}

test("copying a same-name file never overwrites: it creates a separate copy", async (t) => {
  const { source, target } = await fixture(t);
  const original = path.join(source, "report.txt");
  await fs.writeFile(original, "source-data");
  await fs.writeFile(path.join(target, "report.txt"), "destination-data");

  const [result] = await copyFiles([original], target);
  assert.equal(result.ok, true);
  assert.equal(path.basename(result.dest), "report - Copy.txt");
  assert.equal(await fs.readFile(path.join(target, "report.txt"), "utf8"), "destination-data");
  assert.equal(await fs.readFile(result.dest, "utf8"), "source-data");
  assert.equal(await fs.readFile(original, "utf8"), "source-data");
});

test("copying into the same directory makes a safe duplicate", async (t) => {
  const { source } = await fixture(t);
  const original = path.join(source, "notes.md");
  await fs.writeFile(original, "hello");
  const [result] = await copyFiles([original], source);
  assert.equal(result.ok, true);
  assert.equal(path.basename(result.dest), "notes - Copy.md");
  assert.equal(await fs.readFile(original, "utf8"), "hello");
  assert.equal(await fs.readFile(result.dest, "utf8"), "hello");
});

test("copying a directory into itself or its descendant is rejected", async (t) => {
  const { source } = await fixture(t);
  const folder = path.join(source, "folder");
  const child = path.join(folder, "child");
  await fs.mkdir(child, { recursive: true });
  await fs.writeFile(path.join(folder, "file.txt"), "safe");
  const [result] = await copyFiles([folder], child);
  assert.equal(result.ok, false);
  assert.match(result.error, /самой себя/);
  assert.equal(await fs.readFile(path.join(folder, "file.txt"), "utf8"), "safe");
});

test("moving into a destination with a conflicting name does not overwrite or delete source", async (t) => {
  const { source, target } = await fixture(t);
  const original = path.join(source, "data.bin");
  await fs.writeFile(original, "keep-source");
  await fs.writeFile(path.join(target, "data.bin"), "keep-destination");
  const [result] = await moveFiles([original], target);
  assert.equal(result.ok, false);
  assert.equal(await fs.readFile(original, "utf8"), "keep-source");
  assert.equal(await fs.readFile(path.join(target, "data.bin"), "utf8"), "keep-destination");
});

test("moving a file normally transfers it and removes the source", async (t) => {
  const { source, target } = await fixture(t);
  const original = path.join(source, "move.txt");
  await fs.writeFile(original, "move-me");
  const [result] = await moveFiles([original], target);
  assert.equal(result.ok, true);
  await assert.rejects(fs.access(original));
  assert.equal(await fs.readFile(path.join(target, "move.txt"), "utf8"), "move-me");
});

test("renaming to an existing name is rejected without replacing either file", async (t) => {
  const { source } = await fixture(t);
  const first = path.join(source, "one.txt");
  const second = path.join(source, "two.txt");
  await fs.writeFile(first, "one");
  await fs.writeFile(second, "two");
  const result = await renameFile({ oldPath: first, newName: "two.txt" });
  assert.equal(result.ok, false);
  assert.equal(await fs.readFile(first, "utf8"), "one");
  assert.equal(await fs.readFile(second, "utf8"), "two");
});

test("create-folder chooses the next free name instead of failing", async (t) => {
  const { source } = await fixture(t);
  await fs.mkdir(path.join(source, "Новая папка"));
  const result = await createFolder({ dir: source, name: "Новая папка" });
  assert.equal(result.ok, true);
  assert.equal(result.name, "Новая папка (2)");
  assert.equal((await fs.stat(result.path)).isDirectory(), true);
});

test("path containment helper catches descendants but not siblings", async (t) => {
  const { source, target } = await fixture(t);
  const sub = path.join(source, "sub");
  await fs.mkdir(sub);
  assert.equal(_internals.isInsideDirectory(sub, source), true);
  assert.equal(_internals.isInsideDirectory(target, source), false);
});

test("invalid path separators cannot be used as a new entry name", () => {
  assert.throws(() => _internals.validateEntryName("nested/name"), /недопустимые/);
  assert.throws(() => _internals.validateEntryName("nested\\name"), /недопустимые/);
});

test("a folder cannot be copied into itself", async (t) => {
  const { source } = await fixture(t);
  const folder = path.join(source, "folder");
  await fs.mkdir(folder);
  const [result] = await copyFiles([folder], folder);
  assert.equal(result.ok, false);
  assert.match(result.error, /самой себя/);
  assert.deepEqual(await fs.readdir(folder), []);
});

test("a folder cannot be moved into itself", async (t) => {
  const { source } = await fixture(t);
  const folder = path.join(source, "folder");
  await fs.mkdir(folder);
  const [result] = await moveFiles([folder], folder);
  assert.equal(result.ok, false);
  assert.match(result.error, /самой себя/);
  assert.equal((await fs.stat(folder)).isDirectory(), true);
});


test("copying a folder preserves its nested file structure", async (t) => {
  const { source, target } = await fixture(t);
  const folder = path.join(source, "assets");
  await fs.mkdir(path.join(folder, "nested"), { recursive: true });
  await fs.writeFile(path.join(folder, "nested", "item.txt"), "nested-data");

  const [result] = await copyFiles([folder], target);
  assert.equal(result.ok, true);
  assert.equal(
    await fs.readFile(path.join(result.dest, "nested", "item.txt"), "utf8"),
    "nested-data",
  );
  assert.equal(await fs.readFile(path.join(folder, "nested", "item.txt"), "utf8"), "nested-data");
});

test("selecting a folder and one of its children only processes the folder once", async (t) => {
  const { source, target } = await fixture(t);
  const folder = path.join(source, "bundle");
  await fs.mkdir(folder);
  const child = path.join(folder, "child.txt");
  await fs.writeFile(child, "inside");

  const results = await copyFiles([folder, child], target);
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.equal(await fs.readFile(path.join(results[0].dest, "child.txt"), "utf8"), "inside");
});

test("moving a folder and its selected child does not strand or duplicate the child", async (t) => {
  const { source, target } = await fixture(t);
  const folder = path.join(source, "bundle");
  await fs.mkdir(folder);
  await fs.writeFile(path.join(folder, "child.txt"), "inside");

  const results = await moveFiles([folder, path.join(folder, "child.txt")], target);
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.equal(await fs.readFile(path.join(target, "bundle", "child.txt"), "utf8"), "inside");
  await assert.rejects(fs.access(folder));
});

test("Windows reserved names and control characters are rejected", () => {
  assert.throws(() => _internals.validateEntryName("CON", "win32"), /зарезервировано/);
  assert.throws(() => _internals.validateEntryName("report?.txt", "win32"), /Недопустимое имя/);
  assert.throws(() => _internals.validateEntryName("line\u0001break.txt", "win32"), /Недопустимое имя/);
});

test("copying a symbolic link keeps it as a link when supported", async (t) => {
  const { source, target } = await fixture(t);
  const realFile = path.join(source, "real.txt");
  const link = path.join(source, "shortcut.txt");
  await fs.writeFile(realFile, "target");
  try {
    await fs.symlink(realFile, link, "file");
  } catch (error) {
    t.skip(`Symbolic links are unavailable: ${error.message}`);
    return;
  }

  const [result] = await copyFiles([link], target);
  assert.equal(result.ok, true);
  const copiedStat = await fs.lstat(result.dest);
  assert.equal(copiedStat.isSymbolicLink(), true);
  assert.equal(await fs.readFile(result.dest, "utf8"), "target");
});

test("cross-volume move copies first and removes the source only after success", async (t) => {
  const tmpfsRoot = "/dev/shm";
  try {
    const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ghost-cross-src-"));
    const targetRoot = await fs.mkdtemp(path.join(tmpfsRoot, "ghost-cross-dst-"));
    t.after(async () => {
      await fs.rm(sourceRoot, { recursive: true, force: true });
      await fs.rm(targetRoot, { recursive: true, force: true });
    });

    if ((await fs.stat(sourceRoot)).dev === (await fs.stat(targetRoot)).dev) {
      t.skip("Temporary directories are on the same volume");
      return;
    }

    const sourceFile = path.join(sourceRoot, "cross-volume.txt");
    await fs.writeFile(sourceFile, "cross-volume-data");
    const [result] = await moveFiles([sourceFile], targetRoot);
    assert.equal(result.ok, true);
    await assert.rejects(fs.access(sourceFile));
    assert.equal(await fs.readFile(path.join(targetRoot, "cross-volume.txt"), "utf8"), "cross-volume-data");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EACCES" || error.code === "EPERM") {
      t.skip(`A separate temporary volume is unavailable: ${error.message}`);
      return;
    }
    throw error;
  }
});

test("copying a folder with a name conflict creates a sibling copy", async (t) => {
  const { source, target } = await fixture(t);
  const folder = path.join(source, "project");
  const existing = path.join(target, "project");
  await fs.mkdir(folder);
  await fs.mkdir(existing);
  await fs.writeFile(path.join(folder, "source.txt"), "source");
  await fs.writeFile(path.join(existing, "destination.txt"), "destination");

  const [result] = await copyFiles([folder], target);
  assert.equal(result.ok, true);
  assert.equal(path.basename(result.dest), "project - Copy");
  assert.equal(await fs.readFile(path.join(existing, "destination.txt"), "utf8"), "destination");
  assert.equal(await fs.readFile(path.join(result.dest, "source.txt"), "utf8"), "source");
});
