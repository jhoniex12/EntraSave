import { prisma } from '@/config/prisma';

/**
 * RBAC read model (ARCHITECTURE.md §5). The ONLY Prisma access for identity /
 * permission resolution. Roles and permissions are DATABASE-backed (source of
 * truth), not hardcoded and not trusted from the client.
 */
export interface IdentityRecord {
  userId: string;
  email: string;
  sessionVersion: number;
  baseCurrency: string;
  /** "ACTIVE" | "SUSPENDED" | "DELETED" — String column (SQL Server has no enums). */
  status: string;
  roles: string[];
  permissions: string[];
}

export async function loadIdentityByUserId(userId: string): Promise<IdentityRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      sessionVersion: true,
      baseCurrency: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              key: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const roleKeys = user.roles.map((r) => r.role.key);
  const permissionKeys = new Set<string>();
  for (const r of user.roles) {
    for (const p of r.role.permissions) permissionKeys.add(p.permission.key);
  }

  return {
    userId: user.id,
    email: user.email,
    sessionVersion: user.sessionVersion,
    baseCurrency: user.baseCurrency,
    status: user.status,
    roles: roleKeys,
    permissions: [...permissionKeys],
  };
}
