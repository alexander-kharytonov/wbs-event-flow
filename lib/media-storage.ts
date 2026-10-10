import "server-only";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, opendir, realpath, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type MediaVariant,
  mediaVariants,
} from "@/features/events/schemas/event-rich-content";

const keyPattern = /^[a-f0-9]{32}$/;
const filePattern =
  /^([a-f0-9]{32})\.(?:(640|1280|1920)\.webp|social\.jpeg|[a-f0-9-]{36}\.tmp)$/;

export interface MediaStorage {
  validate(): Promise<void>;
  write(key: string, variant: MediaVariant, bytes: Buffer): Promise<void>;
  read(key: string, variant: MediaVariant): Promise<Buffer>;
  remove(key: string): Promise<void>;
  list(): AsyncIterable<{ name: string; key: string; modifiedAt: Date }>;
  removeOrphan(name: string, olderThan: Date): Promise<boolean>;
}

function within(candidate: string, parent: string) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

async function storageRoot() {
  const configured = process.env.MEDIA_STORAGE_ROOT;

  if (
    !configured ||
    !path.isAbsolute(configured) ||
    path.resolve(configured) !== configured
  ) {
    throw new Error(
      "MEDIA_STORAGE_ROOT must be an absolute persistent directory.",
    );
  }

  const uid = process.getuid?.();

  if (uid === undefined) {
    throw new Error("Media storage requires POSIX ownership checks.");
  }

  // Walk top-down before resolving any file paths. Only root and the application
  // OS user may control this chain. Neither is an adversary of this adapter.
  let ancestor = path.parse(configured).root;

  for (const segment of [
    "",
    ...configured.slice(ancestor.length).split(path.sep),
  ]) {
    ancestor = path.join(ancestor, segment);
    const stat = await lstat(ancestor);
    const isRoot = ancestor === configured;

    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.uid !== 0 && stat.uid !== uid) ||
      (stat.mode & 0o022) !== 0 ||
      (isRoot && (stat.uid !== uid || (stat.mode & 0o7777) !== 0o700))
    ) {
      throw new Error(
        "Unsafe media storage ownership, permissions or symlink.",
      );
    }

    if (
      ["public", ".next", ".git"].includes(
        path.basename(ancestor).toLowerCase(),
      )
    ) {
      throw new Error("Unsafe media storage directory.");
    }

    try {
      await lstat(path.join(ancestor, ".git"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    throw new Error("Media storage cannot be inside a Git checkout.");
  }

  const root = await realpath(configured);
  const cwd = await realpath(process.cwd());
  const temporary = await realpath(tmpdir());

  if (
    root !== configured ||
    within(root, cwd) ||
    within(cwd, root) ||
    within(root, temporary) ||
    within(root, "/tmp") ||
    within(root, "/private/tmp") ||
    within(root, "/private/var/tmp") ||
    within(root, "/var/tmp")
  ) {
    throw new Error(
      "Media storage must be a private, owned, persistent directory outside the checkout and temporary directories.",
    );
  }

  return root;
}

function filename(key: string, variant: MediaVariant) {
  if (!keyPattern.test(key) || !mediaVariants.includes(variant)) {
    throw new Error("Invalid media locator.");
  }

  return `${key}.${variant}.${variant === "social" ? "jpeg" : "webp"}`;
}

async function removeFile(root: string, name: string, olderThan?: Date) {
  const target = path.join(root, name);

  try {
    const stat = await lstat(target);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("Unsafe media file; manual investigation required.");
    }

    if (olderThan && stat.mtime > olderThan) {
      return false;
    }

    await unlink(target);

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    return false;
  }
}

const localStorage: MediaStorage = {
  async validate() {
    await storageRoot();
  },
  async write(key, variant, bytes) {
    const name = filename(key, variant);
    const root = await storageRoot();
    const temporary = path.join(root, `${key}.${randomUUID()}.tmp`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );

    try {
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      // Keep the validated canonical path for this operation. Node has no portable
      // openat/unlinkat API; trusted local users must not replace this chain.
      // Hard-link publication is atomic and refuses to overwrite an immutable variant.
      // Runtime-private media is never a deployment-traced application asset.
      await link(temporary, path.join(/* turbopackIgnore: true */ root, name));
    } finally {
      await handle.close();
      await unlink(temporary);
    }
  },
  async read(key, variant) {
    const name = filename(key, variant);
    const root = await storageRoot();
    const handle = await open(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ root,
        name,
      ),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );

    try {
      const stat = await handle.stat();

      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 5 * 1024 * 1024) {
        throw new Error("Invalid media file.");
      }

      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  async remove(key) {
    if (!keyPattern.test(key)) {
      throw new Error("Invalid media locator.");
    }

    const root = await storageRoot();

    // Exactly four paths; temporary files are handled once by reconciliation.
    for (const variant of mediaVariants) {
      await removeFile(root, filename(key, variant));
    }
  },
  async *list() {
    const root = await storageRoot();
    const directory = await opendir(root, { bufferSize: 32 });

    // The iterator closes the directory on completion, failure or early return.
    for await (const entry of directory) {
      const match = filePattern.exec(entry.name);

      if (!match) {
        continue;
      }

      try {
        const stat = await lstat(path.join(root, entry.name));

        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new Error("Unsafe media file; manual investigation required.");
        }

        yield { name: entry.name, key: match[1], modifiedAt: stat.mtime };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
  },
  async removeOrphan(name, olderThan) {
    if (!filePattern.test(name)) {
      throw new Error("Invalid media filename.");
    }

    const root = await storageRoot();

    return removeFile(root, name, olderThan);
  },
};

export function mediaStorage(backend = "LOCAL"): MediaStorage {
  if (backend !== "LOCAL") {
    throw new Error("Unsupported media storage backend.");
  }

  return localStorage;
}
