import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const SOURCE_DIRECTORIES = [
  'src/js/views',
  'src/js/logic',
  'src/js/ui/actions',
];

const FACADES = [
  'src/js/main.js',
  'src/js/store.js',
  'src/js/logic.js',
  'src/js/views.js',
  'src/js/components.js',
];

function toPosixPath(value) {
  const normalized = String(value).replace(/\\/g, '/');
  return normalized.replace(/^\.\//, '').replace(/\/{2,}/g, '/');
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function walk(directoryPath, repoRoot, discovered) {
  let entries;
  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  entries.sort((left, right) => comparePaths(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, repoRoot, discovered);
    } else if (entry.isFile()) {
      discovered.add(toPosixPath(relative(repoRoot, absolutePath)));
    }
  }
}

export async function discoverLegacySurfaces(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.trim().length === 0) {
    throw new TypeError('repoRoot must be a non-empty string');
  }

  const root = resolve(repoRoot);
  const discovered = new Set();

  for (const relativeDirectory of SOURCE_DIRECTORIES) {
    await walk(join(root, ...relativeDirectory.split('/')), root, discovered);
  }

  for (const relativePath of FACADES) {
    if (await isFile(join(root, ...relativePath.split('/')))) {
      discovered.add(relativePath);
    }
  }

  return [...discovered].sort(comparePaths);
}

function normalizeSurface(value) {
  return toPosixPath(value).replace(/\/+$/, '');
}

export function assessSourceCoverage(surfaces, rows, exclusions) {
  const surfaceSet = new Set(
    (Array.isArray(surfaces) ? surfaces : [])
      .filter((surface) => typeof surface === 'string' && surface.trim())
      .map(normalizeSurface),
  );

  const mapped = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !Array.isArray(row.source_paths)) continue;
    for (const sourcePath of row.source_paths) {
      if (typeof sourcePath !== 'string') continue;
      const normalized = normalizeSurface(sourcePath);
      if (surfaceSet.has(normalized)) mapped.add(normalized);
    }
  }

  const validExclusions = new Set();
  const invalidExclusions = [];
  for (const exclusion of Array.isArray(exclusions) ? exclusions : []) {
    const rawPath = exclusion?.path;
    const normalizedPath =
      typeof rawPath === 'string' ? normalizeSurface(rawPath) : '';
    const hasReason =
      typeof exclusion?.reason === 'string' && exclusion.reason.trim().length > 0;
    const pathExists = normalizedPath.length > 0 && surfaceSet.has(normalizedPath);

    if (hasReason && pathExists) {
      validExclusions.add(normalizedPath);
    } else {
      invalidExclusions.push(
        typeof rawPath === 'string' ? rawPath : String(rawPath ?? ''),
      );
    }
  }

  const unmapped = [...surfaceSet]
    .filter((surface) => !mapped.has(surface) && !validExclusions.has(surface))
    .sort(comparePaths);

  return {
    unmapped,
    invalid_exclusions: invalidExclusions,
    mapped_count: mapped.size,
  };
}
