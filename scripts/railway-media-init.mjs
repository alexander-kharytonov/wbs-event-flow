import { execFileSync } from "node:child_process";
import { chown, lstat, mkdir } from "node:fs/promises";

// Deliberately fixed to the approved Railway mount, never recursive chown/chmod.
try {
  if (
    process.env.MEDIA_STORAGE_ROOT !== "/data/media" ||
    process.getuid() !== 0
  ) {
    throw new Error("Invalid provisioning configuration");
  }

  for (const directory of ["/", "/data"]) {
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
    await mkdir("/data/media", { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }

  if (created) {
    await chown("/data/media", 1000, 1000);
  }

  const stat = await lstat("/data/media");
  const acl = execFileSync("getfacl", ["-cp", "/data/media"], {
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
