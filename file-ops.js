"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Не указан путь");
  }
  return path.resolve(value);
}

function pathsEqual(a, b) {
  const aa = normalizePath(a);
  const bb = normalizePath(b);
  return process.platform === "win32"
    ? aa.toLowerCase() === bb.toLowerCase()
    : aa === bb;
}

function isInsideDirectory(candidate, directory) {
  const relative = path.relative(normalizePath(directory), normalizePath(candidate));
  if (!relative) return false;
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validateEntryName(name, platform = process.platform) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Имя не может быть пустым");
  }
  if (name === "." || name === ".." || /[\\/\0]/.test(name)) {
    throw new Error("Имя содержит недопустимые символы");
  }
  if (platform === "win32") {
    if (/[<>:"|?*\x00-\x1F]/.test(name) || /[. ]$/.test(name)) {
      throw new Error("Недопустимое имя для Windows");
    }
    const stem = name.split(".")[0].trimEnd().toUpperCase();
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem)) {
      throw new Error("Это имя зарезервировано Windows");
    }
  }
  return name;
}

async function existsPath(value) {
  try {
    await fsp.lstat(value);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

async function uniqueSiblingPath(parent, prefix) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const candidate = path.join(parent, `${prefix}-${token}`);
    if (!(await existsPath(candidate))) return candidate;
  }
  throw new Error("Не удалось создать временный путь");
}

async function uniqueCopyPath(destDir, sourceName) {
  const parsed = path.parse(sourceName);
  const original = path.join(destDir, sourceName);
  if (!(await existsPath(original))) return original;

  for (let n = 1; n < 10000; n++) {
    const suffix = n === 1 ? " - Copy" : ` - Copy (${n})`;
    const candidate = path.join(destDir, `${parsed.name}${suffix}${parsed.ext}`);
    if (!(await existsPath(candidate))) return candidate;
  }
  throw new Error("Не удалось подобрать свободное имя для копии");
}

async function validateTransfer(sourceInput, destinationInput) {
  const source = normalizePath(sourceInput);
  const destination = normalizePath(destinationInput);
  const sourceStat = await fsp.lstat(source);
  const destinationStat = await fsp.stat(destination);
  if (!destinationStat.isDirectory()) {
    throw new Error("Папка назначения недоступна");
  }

  // Detect directory symlinks/junctions too, so copying a link into its target
  // cannot accidentally create a recursive link structure.
  let effectiveSourceStat = sourceStat;
  if (sourceStat.isSymbolicLink()) {
    effectiveSourceStat = await fsp.stat(source).catch(() => sourceStat);
  }
  if (effectiveSourceStat.isDirectory()) {
    const realSource = await fsp.realpath(source).catch(() => source);
    const realDestination = await fsp.realpath(destination).catch(() => destination);
    if (pathsEqual(realDestination, realSource) || isInsideDirectory(realDestination, realSource)) {
      throw new Error("Нельзя поместить папку внутрь самой себя");
    }
  }
  return { source, destination, sourceStat };
}

// Copy through a private temporary sibling. A failed/partial copy is cleaned
// without ever deleting or overwriting an existing user file at the target.
async function copyEntry(source, destination) {
  if (await existsPath(destination)) {
    throw new Error("В папке назначения уже есть элемент с таким именем");
  }
  const temp = await uniqueSiblingPath(path.dirname(destination), ".ghost-copying");
  try {
    await fsp.cp(source, temp, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
      dereference: false,
    });
    if (await existsPath(destination)) {
      throw new Error("Элемент с таким именем уже появился в папке назначения");
    }
    await fsp.rename(temp, destination);
  } catch (error) {
    try {
      await fsp.rm(temp, { recursive: true, force: true });
    } catch {}
    throw error;
  }
}

async function moveAcrossDevices(source, destination) {
  const temp = await uniqueSiblingPath(path.dirname(destination), ".ghost-moving");
  await copyEntry(source, temp);
  try {
    if (await existsPath(destination)) {
      throw new Error("В папке назначения уже есть элемент с таким именем");
    }
    await fsp.rename(temp, destination);
  } catch (error) {
    try {
      await fsp.rm(temp, { recursive: true, force: true });
    } catch {}
    throw error;
  }
  try {
    await fsp.rm(source, { recursive: true, force: false });
  } catch (error) {
    const partial = new Error(`Копия создана, но исходник не удалён: ${error.message}`);
    partial.partial = true;
    partial.dest = destination;
    throw partial;
  }
}


async function normalizeOperationInputs(values) {
  const unique = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    let normalized;
    try {
      normalized = normalizePath(value);
    } catch {
      unique.push({ input: value, normalized: null, isDirectory: false });
      continue;
    }
    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    let isDirectory = false;
    try {
      const st = await fsp.lstat(normalized);
      const effective = st.isSymbolicLink() ? await fsp.stat(normalized).catch(() => st) : st;
      isDirectory = effective.isDirectory();
    } catch {
      // Keep invalid paths so the caller can return a per-item error.
    }
    unique.push({ input: value, normalized, isDirectory });
  }

  const selectedDirectories = unique
    .filter((item) => item.normalized && item.isDirectory)
    .map((item) => item.normalized);

  return unique
    .filter((item) => !item.normalized || !selectedDirectories.some((parent) =>
      !pathsEqual(parent, item.normalized) && isInsideDirectory(item.normalized, parent)))
    .map((item) => item.input);
}

async function copyFiles(inputPaths, inputDestination) {
  const results = [];
  const inputs = await normalizeOperationInputs(inputPaths);
  for (const input of inputs) {
    let source;
    try {
      const checked = await validateTransfer(input, inputDestination);
      source = checked.source;
      const destination = await uniqueCopyPath(
        checked.destination,
        path.basename(source),
      );
      await copyEntry(source, destination);
      results.push({ src: source, dest: destination, ok: true });
    } catch (error) {
      results.push({ src: source || String(input), ok: false, error: error.message });
    }
  }
  return results;
}

async function moveFiles(inputPaths, inputDestination) {
  const results = [];
  const inputs = await normalizeOperationInputs(inputPaths);
  for (const input of inputs) {
    let source;
    try {
      const checked = await validateTransfer(input, inputDestination);
      source = checked.source;
      const destination = path.join(checked.destination, path.basename(source));
      if (pathsEqual(source, destination)) {
        throw new Error("Элемент уже находится в этой папке");
      }
      if (await existsPath(destination)) {
        throw new Error("В папке назначения уже есть элемент с таким именем");
      }
      try {
        await fsp.rename(source, destination);
      } catch (error) {
        // Only EXDEV means a cross-volume move. Never copy+delete for EACCES,
        // EEXIST, EPERM, or other failures.
        if (error.code !== "EXDEV") throw error;
        await moveAcrossDevices(source, destination);
      }
      results.push({ src: source, dest: destination, ok: true });
    } catch (error) {
      results.push({
        src: source || String(input),
        dest: error.dest,
        ok: false,
        partial: !!error.partial,
        error: error.message,
      });
    }
  }
  return results;
}

async function renameFile(options = {}) {
  const { oldPath, newName } = options || {};
  let source;
  try {
    source = normalizePath(oldPath);
    validateEntryName(newName);
    if (!(await existsPath(source))) throw new Error("Исходный элемент не найден");
    const destination = path.join(path.dirname(source), newName);

    if (pathsEqual(source, destination)) {
      if (path.basename(source) === newName) return { ok: true, newPath: source };
      if (process.platform === "win32") {
        const temp = await uniqueSiblingPath(path.dirname(source), ".ghost-rename");
        await fsp.rename(source, temp);
        try {
          await fsp.rename(temp, destination);
        } catch (error) {
          try { await fsp.rename(temp, source); } catch {}
          throw error;
        }
        return { ok: true, newPath: destination };
      }
    } else if (await existsPath(destination)) {
      throw new Error("Элемент с таким именем уже существует");
    }

    await fsp.rename(source, destination);
    return { ok: true, newPath: destination };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function createFolder(options = {}) {
  const { dir, name } = options || {};
  try {
    const parent = normalizePath(dir);
    validateEntryName(name);
    const parentStat = await fsp.stat(parent);
    if (!parentStat.isDirectory()) throw new Error("Папка назначения недоступна");

    let folderName = name;
    let destination = path.join(parent, folderName);
    let index = 2;
    while (await existsPath(destination)) {
      folderName = `${name} (${index++})`;
      destination = path.join(parent, folderName);
      if (index > 10000) throw new Error("Не удалось подобрать свободное имя");
    }
    await fsp.mkdir(destination);
    return { ok: true, path: destination, name: folderName };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  copyFiles,
  moveFiles,
  renameFile,
  createFolder,
  // exported for unit tests
  _internals: { isInsideDirectory, pathsEqual, validateEntryName, normalizeOperationInputs },
};
