import { execFileSync } from "node:child_process";
import { chown, lstat, mkdir } from "node:fs/promises";
import path from "node:path";

// Provision only the configured directory, never recursive chown/chmod.
try {
  const storageRoot = process.env.MEDIA_STORAGE_ROOT;

  if (
    !storageRoot ||
    !path.isAbsolute(storageRoot) ||
    path.resolve(storageRoot) !== storageRoot ||
    storageRoot === path.parse(storageRoot).root ||
    process.getuid() !== 0
  ) {
    throw new Error("Invalid provisioning configuration");
  }

  const parents = [];
  let parent = path.dirname(storageRoot);

  while (true) {
    parents.unshift(parent);

    if (parent === path.parse(parent).root) {
      break;
    }

    parent = path.dirname(parent);
  }

  for (const directory of parents) {
    const stat = await lstat(directory);

    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      (stat.mode & 0o022) !== 0
    ) {
      throw new Error("Unsafe parent");
    }

    const acl = execFileSync("getfacl", ["-cp", directory], {
      encoding: "utf8",
    });

    if (/^(?:default:|user:[^:]|group:[^:]|mask:)/m.test(acl)) {
      throw new Error("Extended ACL is not permitted");
    }
  }

  let created = false;

  try {
    await mkdir(storageRoot, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }

  if (created) {
    await chown(storageRoot, 1000, 1000);
  }

  const stat = await lstat(storageRoot);
  const acl = execFileSync("getfacl", ["-cp", storageRoot], {
    encoding: "utf8",
  });

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.uid !== 1000 ||
    (stat.mode & 0o7777) !== 0o700 ||
    /^(?:default:|user:[^:]|group:[^:]|mask:)/m.test(acl)
  ) {
    throw new Error("Unsafe media directory");
  }
} catch {
  console.error(
    "Media initialization refused: check the mount, ownership, mode and ACLs.",
  );
  process.exit(1);
}
