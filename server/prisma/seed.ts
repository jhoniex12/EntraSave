import { PrismaClient } from '@prisma/client';

/**
 * Seed default RBAC (ARCHITECTURE.md §5). Roles and permissions are the
 * database-backed source of truth. Idempotent — safe to re-run.
 */
const prisma = new PrismaClient();

const PERMISSIONS = [
  'accounts.read',
  'accounts.write',
  'transactions.read',
  'transactions.write',
  'categories.read',
  'categories.write',
  'settings.write',
  'budgets.read',
  'budgets.write',
  'admin.dashboard.read',
  'admin.users.read',
  'admin.users.write',
  'admin.audit.read',
  'admin.roles.write',
  'admin.settings.write',
] as const;

// roleKey -> permission keys
const ROLES: Record<string, { name: string; permissions: string[] }> = {
  USER: {
    name: 'User',
    permissions: [
      'accounts.read',
      'accounts.write',
      'transactions.read',
      'transactions.write',
      'categories.read',
      'categories.write',
      'settings.write',
      'budgets.read',
      'budgets.write',
    ],
  },
  SUPPORT: {
    name: 'Support (read-only admin)',
    permissions: ['admin.dashboard.read', 'admin.users.read', 'admin.audit.read'],
  },
  ADMIN: {
    name: 'Administrator',
    permissions: [
      'admin.dashboard.read',
      'admin.users.read',
      'admin.users.write',
      'admin.audit.read',
    ],
  },
  SUPERADMIN: {
    name: 'Super Administrator',
    permissions: [...PERMISSIONS],
  },
};

async function main() {
  // Permissions
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, name: key },
      update: {},
    });
  }

  // Roles + role-permission links
  for (const [key, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, name: def.name },
      update: { name: def.name },
    });

    for (const permKey of def.permissions) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete: roles & permissions.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
