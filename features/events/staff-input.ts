import { z } from "zod";

export const staffEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const staffRoleSchema = z.enum(["MANAGER", "RECEPTION"]);

export type StaffInput = {
  email: string;
  role: z.infer<typeof staffRoleSchema>;
};

export function normalizeStaff(members: StaffInput[]) {
  const unique = new Map<string, StaffInput>();
  const duplicates = new Set<string>();
  const conflicts: number[] = [];

  for (const [index, member] of members.entries()) {
    const email = staffEmailSchema.parse(member.email);
    const existing = unique.get(email);

    if (existing && existing.role !== member.role) {
      conflicts.push(index);
    } else if (existing) {
      duplicates.add(email);
    } else {
      unique.set(email, { email, role: member.role });
    }
  }

  return {
    members: [...unique.values()],
    duplicates: [...duplicates],
    conflicts,
  };
}
