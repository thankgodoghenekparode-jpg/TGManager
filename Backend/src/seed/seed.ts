import { PrismaClient } from '../generated/prisma/client';
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
} from '../modules/rbac/permissions/permissions.constants';

const BCRYPT_HASH =
  '$2b$10$0OryoVgl0FB4DxhN5nPGiOuN3VdeenVvyahAzSrvMopwrZa.eBGGe';

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const DEFAULT_PLANS = [
  {
    name: 'Free',
    code: 'free',
    priceCents: 0,
    maxBranches: 1,
    maxStaff: 10,
    featureFlags: { chat: true, workflows: true, reports: true },
  },
  {
    name: 'Pro',
    code: 'pro',
    priceCents: 4900,
    maxBranches: 5,
    maxStaff: 100,
    featureFlags: {
      chat: true,
      workflows: true,
      reports: true,
      inventory: true,
    },
  },
  {
    name: 'Enterprise',
    code: 'enterprise',
    priceCents: 14900,
    maxBranches: null,
    maxStaff: null,
    featureFlags: {
      chat: true,
      workflows: true,
      reports: true,
      inventory: true,
    },
  },
];

// ---------------------------------------------------------------------------
// User seed data
// ---------------------------------------------------------------------------

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  /** Platform-level role */
  platformRole:
    | 'SUPER_ADMIN'
    | 'PLATFORM_SUPPORT'
    | 'COMPANY_ADMIN'
    | 'BRANCH_ADMIN'
    | 'USER';
}

const PLATFORM_USERS: SeedUser[] = [
  {
    email: 'super@tgmanager.com',
    firstName: 'Platform',
    lastName: 'Owner',
    platformRole: 'SUPER_ADMIN',
  },
  {
    email: 'support@tgmanager.com',
    firstName: 'Support',
    lastName: 'Agent',
    platformRole: 'PLATFORM_SUPPORT',
  },
];

const DEMO_USERS: SeedUser[] = [
  {
    email: 'admin@tgmanager-demo.com',
    firstName: 'Demo',
    lastName: 'Admin',
    platformRole: 'COMPANY_ADMIN',
  },
  {
    email: 'ada.okafor@tgmanager-demo.com',
    firstName: 'Ada',
    lastName: 'Okafor',
    platformRole: 'BRANCH_ADMIN',
  },
  {
    email: 'emeka.nwosu@tgmanager-demo.com',
    firstName: 'Emeka',
    lastName: 'Nwosu',
    platformRole: 'BRANCH_ADMIN',
  },
  {
    email: 'fatima.ali@tgmanager-demo.com',
    firstName: 'Fatima',
    lastName: 'Ali',
    platformRole: 'BRANCH_ADMIN',
  },
  {
    email: 'james.balogun@tgmanager-demo.com',
    firstName: 'James',
    lastName: 'Balogun',
    platformRole: 'USER',
  },
  {
    email: 'grace.ekpo@tgmanager-demo.com',
    firstName: 'Grace',
    lastName: 'Ekpo',
    platformRole: 'USER',
  },
  {
    email: 'chidi.obi@tgmanager-demo.com',
    firstName: 'Chidi',
    lastName: 'Obi',
    platformRole: 'USER',
  },
  {
    email: 'sade.adeyemi@tgmanager-demo.com',
    firstName: 'Sade',
    lastName: 'Adeyemi',
    platformRole: 'USER',
  },
  {
    email: 'bola.ogundimu@tgmanager-demo.com',
    firstName: 'Bola',
    lastName: 'Ogundimu',
    platformRole: 'USER',
  },
  {
    email: 'kunle.fashola@tgmanager-demo.com',
    firstName: 'Kunle',
    lastName: 'Fashola',
    platformRole: 'USER',
  },
  {
    email: 'amara.okonkwo@tgmanager-demo.com',
    firstName: 'Amara',
    lastName: 'Okonkwo',
    platformRole: 'USER',
  },
  {
    email: 'tunde.ibrahim@tgmanager-demo.com',
    firstName: 'Tunde',
    lastName: 'Ibrahim',
    platformRole: 'USER',
  },
];

const SUNSHINE_USER: SeedUser = {
  email: 'sunshine@demo.com',
  firstName: 'Sunshine',
  lastName: 'Admin',
  platformRole: 'COMPANY_ADMIN',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isProduction() {
  const env = (process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod';
}

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** Return weekday dates between `from` and `to` (inclusive). */
function weekdayRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Seed plans
// ---------------------------------------------------------------------------

async function seedPlans(prisma: PrismaClient) {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceCents: plan.priceCents,
        maxBranches: plan.maxBranches,
        maxStaff: plan.maxStaff,
        featureFlags: plan.featureFlags,
      },
      create: plan,
    });
  }
  console.log('  ✓ Plans');
}

async function repairExistingDemoLogins(
  prisma: PrismaClient,
  demoTenantId: string,
  sunshineSlug: string,
) {
  const demoUsers = [...PLATFORM_USERS, ...DEMO_USERS];
  const allUsers = [...demoUsers, SUNSHINE_USER];
  const userMap: Record<string, string> = {};

  for (const user of allUsers) {
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: BCRYPT_HASH,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.platformRole,
        isActive: true,
      },
      create: {
        email: user.email,
        passwordHash: BCRYPT_HASH,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.platformRole,
        isActive: true,
      },
    });
    userMap[user.email] = upserted.id;
  }

  for (const user of demoUsers) {
    await prisma.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: demoTenantId,
          userId: userMap[user.email],
        },
      },
      update: {},
      create: {
        tenantId: demoTenantId,
        userId: userMap[user.email],
      },
    });
  }

  const sunshineTenant = await prisma.tenant.findUnique({
    where: { slug: sunshineSlug },
  });
  if (sunshineTenant) {
    await prisma.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: sunshineTenant.id,
          userId: userMap[SUNSHINE_USER.email],
        },
      },
      update: {},
      create: {
        tenantId: sunshineTenant.id,
        userId: userMap[SUNSHINE_USER.email],
      },
    });
  }

  console.log('  Demo login accounts repaired (password: demo1234).');
}

// ---------------------------------------------------------------------------
// Main demo-org seed
// ---------------------------------------------------------------------------

async function seedDemoOrg(prisma: PrismaClient) {
  if (process.env.SEED_DEMO === 'false') {
    console.log('⏭  Skipping demo seed (SEED_DEMO=false).');
    return false;
  }
  if (isProduction() && process.env.SEED_DEMO !== 'true') {
    console.log(
      '⏭  Skipping demo seed (production). Set SEED_DEMO=true to force.',
    );
    return false;
  }

  const demoSlug = 'tgmanager-demo';
  const sunshineSlug = 'sunshine-energy';

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: demoSlug },
  });
  if (existingTenant) {
    await repairExistingDemoLogins(prisma, existingTenant.id, sunshineSlug);
    console.log('⏭  Demo tenant already exists — skipping.');
    return false;
  }

  console.log('🌱  Seeding demo data…');

  const proPlan = await prisma.plan.findUnique({ where: { code: 'pro' } });
  const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
  if (!proPlan || !freePlan)
    throw new Error('Plans not found — run seedPlans first.');

  return prisma.$transaction(async (tx) => {
    // ── 1. Users ────────────────────────────────────────────────────────
    const allUsers = [...PLATFORM_USERS, ...DEMO_USERS, SUNSHINE_USER];
    const userMap: Record<string, string> = {}; // email → id

    for (const u of allUsers) {
      const created = await tx.user.create({
        data: {
          email: u.email,
          passwordHash: BCRYPT_HASH,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.platformRole,
        },
      });
      userMap[u.email] = created.id;
    }
    console.log(`    ✓ ${allUsers.length} users`);

    // ── 2. Tenants ──────────────────────────────────────────────────────
    const demoTenant = await tx.tenant.create({
      data: {
        name: 'TGManager Demo Co.',
        slug: demoSlug,
        planId: proPlan.id,
        onboardingStatus: 'COMPLETED',
        timezone: 'Africa/Lagos',
      },
    });

    const sunshineTenant = await tx.tenant.create({
      data: {
        name: 'Sunshine Energy Ltd',
        slug: sunshineSlug,
        planId: freePlan.id,
        status: 'SUSPENDED',
        onboardingStatus: 'COMPLETED',
        timezone: 'Africa/Lagos',
      },
    });

    await tx.tenantSubscription.createMany({
      data: [
        { tenantId: demoTenant.id, planId: proPlan.id, status: 'ACTIVE' },
        { tenantId: sunshineTenant.id, planId: freePlan.id, status: 'ACTIVE' },
      ],
    });

    // ── 3. TenantUser links ─────────────────────────────────────────────
    // Platform users get membership in demo org
    const demoTenantUserLinks: { tenantId: string; userId: string }[] = [];
    for (const pu of PLATFORM_USERS) {
      demoTenantUserLinks.push({
        tenantId: demoTenant.id,
        userId: userMap[pu.email],
      });
    }
    // All demo users
    for (const du of DEMO_USERS) {
      demoTenantUserLinks.push({
        tenantId: demoTenant.id,
        userId: userMap[du.email],
      });
    }
    // Sunshine user
    demoTenantUserLinks.push({
      tenantId: sunshineTenant.id,
      userId: userMap[SUNSHINE_USER.email],
    });

    await tx.tenantUser.createMany({ data: demoTenantUserLinks });
    console.log('    ✓ TenantUser links');

    // ── 4. Branches ─────────────────────────────────────────────────────
    const branches = await Promise.all([
      tx.branch.create({
        data: {
          tenantId: demoTenant.id,
          name: 'Head Office',
          address: '12 Energy Lane, Lagos',
          latitude: 6.5244,
          longitude: 3.3792,
          radiusMeters: 200,
          phoneNumber: '+2348010000001',
          openingTime: '08:00',
          closingTime: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          status: 'ACTIVE',
        },
      }),
      tx.branch.create({
        data: {
          tenantId: demoTenant.id,
          name: 'Abuja Branch',
          address: '45 Independence Ave, Abuja',
          latitude: 9.0579,
          longitude: 7.4951,
          radiusMeters: 150,
          phoneNumber: '+2348020000002',
          openingTime: '08:00',
          closingTime: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          status: 'ACTIVE',
        },
      }),
      tx.branch.create({
        data: {
          tenantId: demoTenant.id,
          name: 'Port Harcourt Hub',
          address: '10 Trans-Amadi Road, PH',
          latitude: 4.8156,
          longitude: 7.0498,
          radiusMeters: 250,
          phoneNumber: '+2348030000003',
          openingTime: '08:30',
          closingTime: '17:30',
          workingDays: [1, 2, 3, 4, 5],
          status: 'ACTIVE',
        },
      }),
      tx.branch.create({
        data: {
          tenantId: sunshineTenant.id,
          name: 'Sunshine HQ',
          address: '22 Zik Avenue, Enugu',
          latitude: 6.4413,
          longitude: 7.4988,
          radiusMeters: 200,
          phoneNumber: '+2348040000004',
          openingTime: '09:00',
          closingTime: '18:00',
          workingDays: [1, 2, 3, 4, 5],
          status: 'ACTIVE',
        },
      }),
    ]);
    const [lagos, abuja, ph, sunshineHq] = branches;
    console.log('    ✓ 4 branches');

    // ── 5. Departments ──────────────────────────────────────────────────
    const depts = await Promise.all([
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          name: 'Engineering',
          managerUserId: userMap['james.balogun@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          name: 'Operations',
          managerUserId: userMap['grace.ekpo@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: abuja.id,
          name: 'HR',
          managerUserId: userMap['amara.okonkwo@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: abuja.id,
          name: 'Finance',
          managerUserId: userMap['tunde.ibrahim@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: ph.id,
          name: 'Sales',
          managerUserId: userMap['chidi.obi@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: demoTenant.id,
          branchId: ph.id,
          name: 'Operations',
          managerUserId: userMap['grace.ekpo@tgmanager-demo.com'],
        },
      }),
      tx.department.create({
        data: {
          tenantId: sunshineTenant.id,
          branchId: sunshineHq.id,
          name: 'General',
        },
      }),
    ]);
    const [engLag, opsLag, hrAbj, finAbj, salesPh, , sunGen] = depts;
    console.log('    ✓ 7 departments');

    // ── 6. Groups ───────────────────────────────────────────────────────
    const groups = await Promise.all([
      tx.group.create({
        data: {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          name: 'Senior Team',
          description: 'Senior leadership team',
        },
      }),
      tx.group.create({
        data: {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          name: 'New Intake Q3 2026',
          description: 'Q3 2026 new hires',
        },
      }),
      tx.group.create({
        data: {
          tenantId: demoTenant.id,
          branchId: abuja.id,
          name: 'Abuja Core',
          description: 'Core Abuja staff',
        },
      }),
      tx.group.create({
        data: {
          tenantId: demoTenant.id,
          branchId: ph.id,
          name: 'Field Workers',
          description: 'Field operations team',
        },
      }),
    ]);
    const [seniorTeam, newIntake, abujaCore, fieldWorkers] = groups;
    console.log('    ✓ 4 groups');

    // ── 7. Company Roles ────────────────────────────────────────────────
    const companyAdminRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'COMPANY_ADMIN',
        isSystem: true,
        description:
          'Root administrator of the company. Full access to all company settings and data.',
        permissions: [...ALL_PERMISSIONS],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    const branchAdminRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'BRANCH_ADMIN',
        isSystem: true,
        description: 'Administrator of a single branch.',
        permissions: [
          PERMISSIONS.BRANCH_VIEW,
          PERMISSIONS.BRANCH_UPDATE,
          PERMISSIONS.DEPARTMENT_VIEW,
          PERMISSIONS.DEPARTMENT_CREATE,
          PERMISSIONS.DEPARTMENT_UPDATE,
          PERMISSIONS.DEPARTMENT_DELETE,
          PERMISSIONS.GROUP_VIEW,
          PERMISSIONS.GROUP_CREATE,
          PERMISSIONS.GROUP_UPDATE,
          PERMISSIONS.GROUP_DELETE,
          PERMISSIONS.STAFF_VIEW,
          PERMISSIONS.STAFF_CREATE,
          PERMISSIONS.STAFF_UPDATE,
          PERMISSIONS.STAFF_DELETE,
          PERMISSIONS.STAFF_ASSIGN_ROLE,
          PERMISSIONS.ROLE_VIEW,
          PERMISSIONS.ROLE_CREATE,
          PERMISSIONS.ROLE_UPDATE,
          PERMISSIONS.ROLE_DELETE,
          PERMISSIONS.ROLE_ASSIGN,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.ATTENDANCE_MANAGE,
          PERMISSIONS.SCHEDULE_MANAGE,
          PERMISSIONS.DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENT_CREATE,
          PERMISSIONS.DOCUMENT_UPDATE,
          PERMISSIONS.DOCUMENT_DELETE,
          PERMISSIONS.INVENTORY_VIEW,
          PERMISSIONS.INVENTORY_MANAGE,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.MEMO_CREATE,
          PERMISSIONS.MEMO_MANAGE,
          PERMISSIONS.FORM_VIEW,
          PERMISSIONS.FORM_CREATE,
          PERMISSIONS.FORM_MANAGE,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.REPORT_VIEW,
          PERMISSIONS.REPORT_SUBMIT,
          PERMISSIONS.REPORT_MANAGE,
          PERMISSIONS.WORKFLOW_VIEW,
          PERMISSIONS.WORKFLOW_CREATE,
          PERMISSIONS.WORKFLOW_SUBMIT,
          PERMISSIONS.WORKFLOW_APPROVE,
          PERMISSIONS.CHAT_CREATE,
          PERMISSIONS.CHAT_VIEW,
          PERMISSIONS.AUDIT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    const deptManagerRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'DEPARTMENT_MANAGER',
        isSystem: true,
        description:
          'Manages staff and day-to-day operations within a department.',
        permissions: [
          PERMISSIONS.DEPARTMENT_VIEW,
          PERMISSIONS.GROUP_VIEW,
          PERMISSIONS.STAFF_VIEW,
          PERMISSIONS.STAFF_CREATE,
          PERMISSIONS.STAFF_UPDATE,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENT_CREATE,
          PERMISSIONS.INVENTORY_VIEW,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.MEMO_CREATE,
          PERMISSIONS.FORM_VIEW,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.REPORT_VIEW,
          PERMISSIONS.REPORT_SUBMIT,
          PERMISSIONS.REPORT_MANAGE,
          PERMISSIONS.WORKFLOW_VIEW,
          PERMISSIONS.WORKFLOW_SUBMIT,
          PERMISSIONS.WORKFLOW_APPROVE,
          PERMISSIONS.CHAT_CREATE,
          PERMISSIONS.CHAT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    const staffRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'STAFF',
        isSystem: true,
        description:
          'Regular staff member. Can clock in/out, view assigned content and submit workflows.',
        permissions: [
          PERMISSIONS.ATTENDANCE_CLOCK_IN,
          PERMISSIONS.ATTENDANCE_CLOCK_OUT,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.DOCUMENT_VIEW,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.WORKFLOW_SUBMIT,
          PERMISSIONS.CHAT_CREATE,
          PERMISSIONS.CHAT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    const projectLeadRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'PROJECT_LEAD',
        isSystem: false,
        description:
          'Engineering team lead. Manages workflows, inventory and project documentation.',
        permissions: [
          PERMISSIONS.DEPARTMENT_VIEW,
          PERMISSIONS.STAFF_VIEW,
          PERMISSIONS.STAFF_CREATE,
          PERMISSIONS.STAFF_UPDATE,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.ATTENDANCE_MANAGE,
          PERMISSIONS.DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENT_CREATE,
          PERMISSIONS.DOCUMENT_UPDATE,
          PERMISSIONS.INVENTORY_VIEW,
          PERMISSIONS.INVENTORY_MANAGE,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.MEMO_CREATE,
          PERMISSIONS.FORM_VIEW,
          PERMISSIONS.FORM_CREATE,
          PERMISSIONS.FORM_MANAGE,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.REPORT_VIEW,
          PERMISSIONS.WORKFLOW_VIEW,
          PERMISSIONS.WORKFLOW_CREATE,
          PERMISSIONS.WORKFLOW_SUBMIT,
          PERMISSIONS.WORKFLOW_APPROVE,
          PERMISSIONS.CHAT_CREATE,
          PERMISSIONS.CHAT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    const salesRepRole = await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'SALES_REP',
        isSystem: false,
        description:
          'Sales team member. Can submit forms, view reports and chat.',
        permissions: [
          PERMISSIONS.STAFF_VIEW,
          PERMISSIONS.ATTENDANCE_CLOCK_IN,
          PERMISSIONS.ATTENDANCE_CLOCK_OUT,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.DOCUMENT_VIEW,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.FORM_VIEW,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.REPORT_VIEW,
          PERMISSIONS.WORKFLOW_VIEW,
          PERMISSIONS.WORKFLOW_SUBMIT,
          PERMISSIONS.CHAT_CREATE,
          PERMISSIONS.CHAT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    await tx.companyRole.create({
      data: {
        tenantId: demoTenant.id,
        name: 'INTERN',
        isSystem: false,
        description:
          'Intern with minimal access. Can clock in/out, view memos and submit forms.',
        permissions: [
          PERMISSIONS.ATTENDANCE_CLOCK_IN,
          PERMISSIONS.ATTENDANCE_CLOCK_OUT,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.MEMO_VIEW,
          PERMISSIONS.FORM_SUBMIT,
          PERMISSIONS.CHAT_VIEW,
        ],
        createdByUserId: userMap['admin@tgmanager-demo.com'],
      },
    });

    // Sunshine COMPANY_ADMIN
    const sunAdminRole = await tx.companyRole.create({
      data: {
        tenantId: sunshineTenant.id,
        name: 'COMPANY_ADMIN',
        isSystem: true,
        description: 'Root administrator.',
        permissions: [...ALL_PERMISSIONS],
        createdByUserId: userMap['sunshine@demo.com'],
      },
    });

    console.log('    ✓ 8 company roles');

    // ── 8. Role Assignments (THE CRITICAL FIX) ──────────────────────────
    const roleAssignments: {
      tenantId: string;
      userId: string;
      companyRoleId: string;
      assignedByUserId: string;
      branchId?: string;
    }[] = [];

    const adminId = userMap['admin@tgmanager-demo.com'];

    // Platform users
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['super@tgmanager.com'],
      companyRoleId: companyAdminRole.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['support@tgmanager.com'],
      companyRoleId: staffRole.id,
      assignedByUserId: adminId,
    });

    // Demo org users
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: adminId,
      companyRoleId: companyAdminRole.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['ada.okafor@tgmanager-demo.com'],
      companyRoleId: branchAdminRole.id,
      branchId: lagos.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['emeka.nwosu@tgmanager-demo.com'],
      companyRoleId: branchAdminRole.id,
      branchId: abuja.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['fatima.ali@tgmanager-demo.com'],
      companyRoleId: branchAdminRole.id,
      branchId: ph.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['james.balogun@tgmanager-demo.com'],
      companyRoleId: projectLeadRole.id,
      branchId: lagos.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['grace.ekpo@tgmanager-demo.com'],
      companyRoleId: deptManagerRole.id,
      branchId: lagos.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['chidi.obi@tgmanager-demo.com'],
      companyRoleId: salesRepRole.id,
      branchId: ph.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['sade.adeyemi@tgmanager-demo.com'],
      companyRoleId: staffRole.id,
      branchId: lagos.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['bola.ogundimu@tgmanager-demo.com'],
      companyRoleId: staffRole.id,
      branchId: lagos.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['kunle.fashola@tgmanager-demo.com'],
      companyRoleId: salesRepRole.id,
      branchId: ph.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['amara.okonkwo@tgmanager-demo.com'],
      companyRoleId: deptManagerRole.id,
      branchId: abuja.id,
      assignedByUserId: adminId,
    });
    roleAssignments.push({
      tenantId: demoTenant.id,
      userId: userMap['tunde.ibrahim@tgmanager-demo.com'],
      companyRoleId: deptManagerRole.id,
      branchId: abuja.id,
      assignedByUserId: adminId,
    });

    // Sunshine
    roleAssignments.push({
      tenantId: sunshineTenant.id,
      userId: userMap['sunshine@demo.com'],
      companyRoleId: sunAdminRole.id,
      assignedByUserId: userMap['sunshine@demo.com'],
    });

    await tx.roleAssignment.createMany({ data: roleAssignments });
    console.log(`    ✓ ${roleAssignments.length} role assignments`);

    // ── 9. Staff Records ────────────────────────────────────────────────
    const staffRecords: {
      tenantId: string;
      userId: string;
      branchId: string;
      departmentId?: string;
      jobTitle: string;
      employeeCode: string;
      isActive: boolean;
    }[] = [
      {
        tenantId: demoTenant.id,
        userId: adminId,
        branchId: lagos.id,
        departmentId: engLag.id,
        jobTitle: 'CEO',
        employeeCode: 'EMP001',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['ada.okafor@tgmanager-demo.com'],
        branchId: lagos.id,
        departmentId: opsLag.id,
        jobTitle: 'Branch Manager — Lagos',
        employeeCode: 'EMP002',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['emeka.nwosu@tgmanager-demo.com'],
        branchId: abuja.id,
        departmentId: hrAbj.id,
        jobTitle: 'Branch Manager — Abuja',
        employeeCode: 'EMP003',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['fatima.ali@tgmanager-demo.com'],
        branchId: ph.id,
        departmentId: salesPh.id,
        jobTitle: 'Branch Manager — PH',
        employeeCode: 'EMP004',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['james.balogun@tgmanager-demo.com'],
        branchId: lagos.id,
        departmentId: engLag.id,
        jobTitle: 'Engineering Lead',
        employeeCode: 'EMP005',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['grace.ekpo@tgmanager-demo.com'],
        branchId: lagos.id,
        departmentId: opsLag.id,
        jobTitle: 'Operations Lead',
        employeeCode: 'EMP006',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['chidi.obi@tgmanager-demo.com'],
        branchId: ph.id,
        departmentId: salesPh.id,
        jobTitle: 'Sales Lead',
        employeeCode: 'EMP007',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['sade.adeyemi@tgmanager-demo.com'],
        branchId: lagos.id,
        departmentId: engLag.id,
        jobTitle: 'Software Engineer',
        employeeCode: 'EMP008',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['bola.ogundimu@tgmanager-demo.com'],
        branchId: lagos.id,
        departmentId: opsLag.id,
        jobTitle: 'Operations Officer',
        employeeCode: 'EMP009',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['kunle.fashola@tgmanager-demo.com'],
        branchId: ph.id,
        departmentId: salesPh.id,
        jobTitle: 'Sales Executive',
        employeeCode: 'EMP010',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['amara.okonkwo@tgmanager-demo.com'],
        branchId: abuja.id,
        departmentId: hrAbj.id,
        jobTitle: 'HR Officer',
        employeeCode: 'EMP011',
        isActive: true,
      },
      {
        tenantId: demoTenant.id,
        userId: userMap['tunde.ibrahim@tgmanager-demo.com'],
        branchId: abuja.id,
        departmentId: finAbj.id,
        jobTitle: 'Finance Analyst',
        employeeCode: 'EMP012',
        isActive: true,
      },
      {
        tenantId: sunshineTenant.id,
        userId: userMap['sunshine@demo.com'],
        branchId: sunshineHq.id,
        departmentId: sunGen.id,
        jobTitle: 'Director',
        employeeCode: 'SUN001',
        isActive: true,
      },
    ];

    const createdStaffRecords = await Promise.all(
      staffRecords.map((sr) => tx.staffRecord.create({ data: sr })),
    );
    console.log(`    ✓ ${createdStaffRecords.length} staff records`);

    // Map email → staffRecordId for attendance etc.
    const staffByEmail: Record<string, string> = {};
    createdStaffRecords.forEach((sr, i) => {
      staffByEmail[staffRecords[i].userId] = sr.id;
    });

    // ── 10. Staff Groups ────────────────────────────────────────────────
    const sgData: { staffRecordId: string; groupId: string }[] = [
      { staffRecordId: staffByEmail[adminId], groupId: seniorTeam.id },
      {
        staffRecordId: staffByEmail[userMap['ada.okafor@tgmanager-demo.com']],
        groupId: seniorTeam.id,
      },
      {
        staffRecordId:
          staffByEmail[userMap['james.balogun@tgmanager-demo.com']],
        groupId: seniorTeam.id,
      },
      {
        staffRecordId: staffByEmail[userMap['sade.adeyemi@tgmanager-demo.com']],
        groupId: newIntake.id,
      },
      {
        staffRecordId:
          staffByEmail[userMap['bola.ogundimu@tgmanager-demo.com']],
        groupId: newIntake.id,
      },
      {
        staffRecordId: staffByEmail[userMap['emeka.nwosu@tgmanager-demo.com']],
        groupId: abujaCore.id,
      },
      {
        staffRecordId:
          staffByEmail[userMap['amara.okonkwo@tgmanager-demo.com']],
        groupId: abujaCore.id,
      },
      {
        staffRecordId:
          staffByEmail[userMap['tunde.ibrahim@tgmanager-demo.com']],
        groupId: abujaCore.id,
      },
      {
        staffRecordId: staffByEmail[userMap['fatima.ali@tgmanager-demo.com']],
        groupId: fieldWorkers.id,
      },
      {
        staffRecordId: staffByEmail[userMap['chidi.obi@tgmanager-demo.com']],
        groupId: fieldWorkers.id,
      },
    ];
    await tx.staffGroup.createMany({ data: sgData });
    console.log('    ✓ 10 staff-group memberships');

    // ── 11. Schedules ───────────────────────────────────────────────────
    await tx.schedule.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          scope: 'BRANCH',
          branchId: lagos.id,
          resumptionTime: '08:00',
          closingTime: '17:00',
          latePeriodMinutes: 30,
          workingDays: [1, 2, 3, 4, 5],
          timezone: 'Africa/Lagos',
        },
        {
          tenantId: demoTenant.id,
          scope: 'BRANCH',
          branchId: abuja.id,
          resumptionTime: '08:00',
          closingTime: '17:00',
          latePeriodMinutes: 30,
          workingDays: [1, 2, 3, 4, 5],
          timezone: 'Africa/Lagos',
        },
        {
          tenantId: demoTenant.id,
          scope: 'BRANCH',
          branchId: ph.id,
          resumptionTime: '08:30',
          closingTime: '17:30',
          latePeriodMinutes: 30,
          workingDays: [1, 2, 3, 4, 5],
          timezone: 'Africa/Lagos',
        },
      ],
    });
    console.log('    ✓ 3 schedules');

    // ── 12. Forms ───────────────────────────────────────────────────────
    const leaveForm = await tx.form.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        name: 'Leave Request',
        description: 'Request time off',
        isPublished: true,
      },
    });
    const expenseForm = await tx.form.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        name: 'Expense Claim',
        description: 'Reimbursable business expenses',
        isPublished: true,
      },
    });
    const incidentForm = await tx.form.create({
      data: {
        tenantId: demoTenant.id,
        branchId: ph.id,
        createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
        name: 'Incident Report',
        description: 'Report a safety or operational incident',
        isPublished: true,
      },
    });

    await tx.formField.createMany({
      data: [
        {
          formId: leaveForm.id,
          key: 'start_date',
          label: 'Start Date',
          type: 'date',
          required: true,
          order: 0,
        },
        {
          formId: leaveForm.id,
          key: 'end_date',
          label: 'End Date',
          type: 'date',
          required: true,
          order: 1,
        },
        {
          formId: leaveForm.id,
          key: 'reason',
          label: 'Reason',
          type: 'text',
          required: true,
          order: 2,
        },
        {
          formId: leaveForm.id,
          key: 'days',
          label: 'Number of Days',
          type: 'number',
          required: true,
          order: 3,
        },

        {
          formId: expenseForm.id,
          key: 'date',
          label: 'Date',
          type: 'date',
          required: true,
          order: 0,
        },
        {
          formId: expenseForm.id,
          key: 'amount',
          label: 'Amount (NGN)',
          type: 'number',
          required: true,
          order: 1,
        },
        {
          formId: expenseForm.id,
          key: 'description',
          label: 'Description',
          type: 'text',
          required: true,
          order: 2,
        },
        {
          formId: expenseForm.id,
          key: 'receipt_attached',
          label: 'Receipt Attached',
          type: 'boolean',
          required: false,
          order: 3,
        },

        {
          formId: incidentForm.id,
          key: 'date',
          label: 'Date of Incident',
          type: 'date',
          required: true,
          order: 0,
        },
        {
          formId: incidentForm.id,
          key: 'location',
          label: 'Location',
          type: 'text',
          required: true,
          order: 1,
        },
        {
          formId: incidentForm.id,
          key: 'description',
          label: 'Description',
          type: 'text',
          required: true,
          order: 2,
        },
        {
          formId: incidentForm.id,
          key: 'severity',
          label: 'Severity',
          type: 'select',
          required: true,
          order: 3,
          options: ['Low', 'Medium', 'High', 'Critical'],
        },
      ],
    });
    console.log('    ✓ 3 forms with 11 fields');

    // ── 13. Form Submissions ────────────────────────────────────────────
    await tx.formSubmission.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          formId: leaveForm.id,
          refNumber: 'ZV-2026-00001',
          submittedByUserId: userMap['sade.adeyemi@tgmanager-demo.com'],
          data: {
            start_date: '2026-09-01',
            end_date: '2026-09-05',
            reason: 'Annual vacation',
            days: 5,
          },
        },
        {
          tenantId: demoTenant.id,
          formId: leaveForm.id,
          refNumber: 'ZV-2026-00002',
          submittedByUserId: userMap['bola.ogundimu@tgmanager-demo.com'],
          data: {
            start_date: '2026-09-10',
            end_date: '2026-09-12',
            reason: 'Medical appointment',
            days: 3,
          },
        },
        {
          tenantId: demoTenant.id,
          formId: expenseForm.id,
          refNumber: 'ZV-2026-00003',
          submittedByUserId: userMap['kunle.fashola@tgmanager-demo.com'],
          data: {
            date: '2026-08-20',
            amount: 45000,
            description: 'Client meeting transport',
            receipt_attached: true,
          },
        },
        {
          tenantId: demoTenant.id,
          formId: expenseForm.id,
          refNumber: 'ZV-2026-00004',
          submittedByUserId: userMap['chidi.obi@tgmanager-demo.com'],
          data: {
            date: '2026-08-22',
            amount: 120000,
            description: 'Team lunch	- sales closing',
            receipt_attached: true,
          },
        },
        {
          tenantId: demoTenant.id,
          formId: incidentForm.id,
          refNumber: 'ZV-2026-00005',
          submittedByUserId: userMap['fatima.ali@tgmanager-demo.com'],
          data: {
            date: '2026-08-18',
            location: 'PH warehouse',
            description: 'Minor spillage near loading bay',
            severity: 'Low',
          },
        },
      ],
    });
    console.log('    ✓ 5 form submissions');

    // ── 14. Workflow Templates ──────────────────────────────────────────
    const leaveTemplate = await tx.workflowTemplate.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        name: 'Leave Approval',
        description: 'Standard leave request approval',
        formId: leaveForm.id,
        isActive: true,
      },
    });
    const expenseTemplate = await tx.workflowTemplate.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        name: 'Expense Approval',
        description: 'Expense claim approval',
        formId: expenseForm.id,
        isActive: true,
      },
    });
    const incidentTemplate = await tx.workflowTemplate.create({
      data: {
        tenantId: demoTenant.id,
        branchId: ph.id,
        createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
        name: 'Incident Review',
        description: 'Incident report review',
        formId: incidentForm.id,
        isActive: true,
      },
    });

    // Steps
    const [leaveStep1, leaveStep2] = await Promise.all([
      tx.workflowStep.create({
        data: {
          templateId: leaveTemplate.id,
          name: 'Manager Approval',
          order: 1,
          action: 'APPROVE',
          assigneeRuleType: 'COMPANY_ROLE',
          isFinal: false,
          isRequired: true,
          dueInMinutes: 1440,
        },
      }),
      tx.workflowStep.create({
        data: {
          templateId: leaveTemplate.id,
          name: 'HR Final Approval',
          order: 2,
          action: 'APPROVE',
          assigneeRuleType: 'COMPANY_ROLE',
          isFinal: true,
          isRequired: true,
          dueInMinutes: 2880,
        },
      }),
    ]);

    const [expenseStep1, expenseStep2] = await Promise.all([
      tx.workflowStep.create({
        data: {
          templateId: expenseTemplate.id,
          name: 'Manager Approval',
          order: 1,
          action: 'APPROVE',
          assigneeRuleType: 'COMPANY_ROLE',
          isFinal: false,
          isRequired: true,
          dueInMinutes: 1440,
        },
      }),
      tx.workflowStep.create({
        data: {
          templateId: expenseTemplate.id,
          name: 'Finance Approval',
          order: 2,
          action: 'APPROVE',
          assigneeRuleType: 'COMPANY_ROLE',
          isFinal: true,
          isRequired: true,
          dueInMinutes: 4320,
        },
      }),
    ]);

    await tx.workflowStep.create({
      data: {
        templateId: incidentTemplate.id,
        name: 'Immediate Review',
        order: 1,
        action: 'APPROVE',
        assigneeRuleType: 'COMPANY_ROLE',
        isFinal: true,
        isRequired: true,
        dueInMinutes: 2880,
      },
    });

    // Escalations
    await tx.workflowEscalation.createMany({
      data: [
        {
          stepId: leaveStep1.id,
          type: 'AUTO_ACTION',
          trigger: 'TIMEOUT',
          timeoutMinutes: 2880,
          action: 'APPROVE',
          priority: 1,
        },
        {
          stepId: expenseStep1.id,
          type: 'NOTIFY',
          trigger: 'TIMEOUT',
          timeoutMinutes: 1440,
          action: 'NOTIFY_ADMIN',
          priority: 1,
        },
      ],
    });
    console.log('    ✓ 3 workflow templates with steps + escalations');

    // ── 15. Workflow Instances ──────────────────────────────────────────
    // Instance 1: Approved leave
    const wfLeaveApproved = await tx.workflowInstance.create({
      data: {
        tenantId: demoTenant.id,
        templateId: leaveTemplate.id,
        branchId: lagos.id,
        title: 'Leave — Sade Adeyemi (Aug 25–29)',
        status: 'APPROVED',
        initiatedByUserId: userMap['sade.adeyemi@tgmanager-demo.com'],
        payload: {
          start_date: '2026-08-25',
          end_date: '2026-08-29',
          reason: 'Annual break',
          days: 5,
        },
      },
    });
    await tx.workflowStepInstance.createMany({
      data: [
        {
          instanceId: wfLeaveApproved.id,
          stepId: leaveStep1.id,
          status: 'COMPLETED',
          assignedToUserId: userMap['ada.okafor@tgmanager-demo.com'],
          actionedById: userMap['ada.okafor@tgmanager-demo.com'],
          actionedAt: d(2026, 8, 22),
          note: 'Approved — enjoy!',
        },
        {
          instanceId: wfLeaveApproved.id,
          stepId: leaveStep2.id,
          status: 'COMPLETED',
          assignedToUserId: userMap['amara.okonkwo@tgmanager-demo.com'],
          actionedById: userMap['amara.okonkwo@tgmanager-demo.com'],
          actionedAt: d(2026, 8, 23),
          note: 'HR confirmed.',
        },
      ],
    });

    // Instance 2: Pending leave
    const wfLeavePending = await tx.workflowInstance.create({
      data: {
        tenantId: demoTenant.id,
        templateId: leaveTemplate.id,
        branchId: lagos.id,
        title: 'Leave — Bola Ogundimu (Sep 10–12)',
        status: 'PENDING',
        initiatedByUserId: userMap['bola.ogundimu@tgmanager-demo.com'],
        payload: {
          start_date: '2026-09-10',
          end_date: '2026-09-12',
          reason: 'Medical appointment',
          days: 3,
        },
      },
    });
    await tx.workflowStepInstance.create({
      data: {
        instanceId: wfLeavePending.id,
        stepId: leaveStep1.id,
        status: 'PENDING',
        assignedToUserId: userMap['grace.ekpo@tgmanager-demo.com'],
      },
    });

    // Instance 3: Approved expense
    const wfExpenseApproved = await tx.workflowInstance.create({
      data: {
        tenantId: demoTenant.id,
        templateId: expenseTemplate.id,
        branchId: ph.id,
        title: 'Expense — Kunle Fashola (₦45,000)',
        status: 'APPROVED',
        initiatedByUserId: userMap['kunle.fashola@tgmanager-demo.com'],
        payload: {
          date: '2026-08-20',
          amount: 45000,
          description: 'Client meeting transport',
          receipt_attached: true,
        },
      },
    });
    await tx.workflowStepInstance.createMany({
      data: [
        {
          instanceId: wfExpenseApproved.id,
          stepId: expenseStep1.id,
          status: 'COMPLETED',
          assignedToUserId: userMap['fatima.ali@tgmanager-demo.com'],
          actionedById: userMap['fatima.ali@tgmanager-demo.com'],
          actionedAt: d(2026, 8, 21),
        },
        {
          instanceId: wfExpenseApproved.id,
          stepId: expenseStep2.id,
          status: 'COMPLETED',
          assignedToUserId: userMap['tunde.ibrahim@tgmanager-demo.com'],
          actionedById: userMap['tunde.ibrahim@tgmanager-demo.com'],
          actionedAt: d(2026, 8, 22),
        },
      ],
    });

    // Instance 4: Rejected expense
    const wfExpenseRejected = await tx.workflowInstance.create({
      data: {
        tenantId: demoTenant.id,
        templateId: expenseTemplate.id,
        branchId: ph.id,
        title: 'Expense — Chidi Obi (₦120,000)',
        status: 'REJECTED',
        initiatedByUserId: userMap['chidi.obi@tgmanager-demo.com'],
        payload: {
          date: '2026-08-22',
          amount: 120000,
          description: 'Team lunch — sales closing',
          receipt_attached: true,
        },
      },
    });
    await tx.workflowStepInstance.create({
      data: {
        instanceId: wfExpenseRejected.id,
        stepId: expenseStep1.id,
        status: 'REJECTED',
        assignedToUserId: userMap['fatima.ali@tgmanager-demo.com'],
        actionedById: userMap['fatima.ali@tgmanager-demo.com'],
        actionedAt: d(2026, 8, 23),
        note: 'Over budget — resubmit with lower estimate.',
      },
    });

    console.log(
      '    ✓ 4 workflow instances (2 approved, 1 pending, 1 rejected)',
    );

    // ── 16. Memos ───────────────────────────────────────────────────────
    const memoWelcome = await tx.memo.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        title: 'Welcome to TGManager',
        body: [
          'Welcome to the team! This memo introduces you to the TGManager platform.',
          'From today you can clock in and out, request leave, chat with colleagues and ' +
            'submit your weekly reports right from the dashboard.',
          '',
          'Please sign in and set up your profile over the next few days.',
          '',
          'Demo Admin',
        ].join('\n'),
        through: 'Operations Manager',
        audience: { all: true },
        publishedAt: d(2026, 8, 13),
      },
    });
    const memoSafety = await tx.memo.create({
      data: {
        tenantId: demoTenant.id,
        branchId: ph.id,
        createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
        title: 'Q3 Safety Guidelines',
        body: [
          'All field staff must complete the new safety checklist before starting site visits. ' +
            'Hard hats and reflective vests are now mandatory on every job site without exception.',
          '',
          'The updated checklist is available on the documents page. Site leads should review ' +
            'it with their crew at the start of each week.',
          '',
          'Fatima Ali',
        ].join('\n'),
        through: 'Chidi Obi (Sales Lead)',
        audience: { branchIds: [ph.id] },
        publishedAt: d(2026, 8, 15),
      },
    });
    const memoOffice = await tx.memo.create({
      data: {
        tenantId: demoTenant.id,
        branchId: lagos.id,
        createdByUserId: adminId,
        title: 'Office Renovation Notice',
        body: [
          'The Lagos head office will undergo renovations from 1–7 September. ' +
            'Remote work is encouraged during this period, and the meeting rooms will be unavailable.',
          '',
          'Please plan your on-site days accordingly. Floor plans and the hot-desking roster ' +
            'will be shared closer to the date.',
          '',
          'Demo Admin',
        ].join('\n'),
        through: 'Operations Manager',
        audience: { all: true },
        publishedAt: d(2026, 8, 20),
      },
    });
    await tx.memo.create({
      data: {
        tenantId: demoTenant.id,
        branchId: ph.id,
        createdByUserId: adminId,
        title: 'New Sales Incentives',
        body: [
          'Draft — pending approval. A revised commission structure for the Q4 push will be ' +
            'shared with the sales team before the end of the month.',
          '',
          'Demo Admin',
        ].join('\n'),
        through: 'Fatima Ali (Branch Admin, PH)',
        audience: { departmentIds: [salesPh.id] },
        publishedAt: null,
      },
    });

    // Memo reads
    const allDemoEmails = DEMO_USERS.map((u) => userMap[u.email]);
    const memoReads: { memoId: string; userId: string }[] = [];
    for (const uid of allDemoEmails) {
      memoReads.push({ memoId: memoWelcome.id, userId: uid });
    }
    memoReads.push({ memoId: memoSafety.id, userId: adminId });
    memoReads.push({
      memoId: memoSafety.id,
      userId: userMap['fatima.ali@tgmanager-demo.com'],
    });
    memoReads.push({
      memoId: memoSafety.id,
      userId: userMap['chidi.obi@tgmanager-demo.com'],
    });
    memoReads.push({
      memoId: memoSafety.id,
      userId: userMap['kunle.fashola@tgmanager-demo.com'],
    });
    // Only a few staff have read the renovation notice — most remain unread.
    memoReads.push({ memoId: memoOffice.id, userId: adminId });
    memoReads.push({
      memoId: memoOffice.id,
      userId: userMap['ada.okafor@tgmanager-demo.com'],
    });
    memoReads.push({
      memoId: memoOffice.id,
      userId: userMap['james.balogun@tgmanager-demo.com'],
    });
    await tx.memoRead.createMany({ data: memoReads });
    console.log('    ✓ 4 memos with reads');

    // ── 17. Inventory Items ─────────────────────────────────────────────
    await tx.inventoryItem.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          sku: 'SOL-PNL-001',
          name: 'Solar Panel Kit (300W)',
          quantity: 50,
          unit: 'units',
          minQuantity: 10,
          location: 'Lagos Warehouse A',
          createdByUserId: userMap['james.balogun@tgmanager-demo.com'],
        },
        {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          sku: 'INV-3000-001',
          name: 'Hybrid Inverter 3kVA',
          quantity: 30,
          unit: 'units',
          minQuantity: 5,
          location: 'Lagos Warehouse A',
          createdByUserId: userMap['james.balogun@tgmanager-demo.com'],
        },
        {
          tenantId: demoTenant.id,
          branchId: ph.id,
          sku: 'CBL-RLL-001',
          name: 'Armoured Cable Reel (50m)',
          quantity: 100,
          unit: 'rolls',
          minQuantity: 20,
          location: 'PH Storage',
          createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
        },
        {
          tenantId: demoTenant.id,
          branchId: abuja.id,
          sku: 'SAF-HLM-001',
          name: 'Safety Helmet (Class A)',
          quantity: 200,
          unit: 'pieces',
          minQuantity: 50,
          location: 'Abuja Depot',
          createdByUserId: userMap['emeka.nwosu@tgmanager-demo.com'],
        },
        {
          tenantId: demoTenant.id,
          branchId: ph.id,
          sku: 'BAT-LFP-001',
          name: 'LiFePO4 Battery Pack (5kWh)',
          quantity: 75,
          unit: 'units',
          minQuantity: 15,
          location: 'PH Storage',
          createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
        },
      ],
    });
    console.log('    ✓ 5 inventory items');

    // ── 18. Documents ───────────────────────────────────────────────────
    await tx.document.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          branchId: lagos.id,
          createdByUserId: adminId,
          title: 'Employee Handbook v2',
          type: 'GENERAL',
          metadata: { version: '2.0', pages: 42 },
        },
        {
          tenantId: demoTenant.id,
          branchId: ph.id,
          createdByUserId: userMap['fatima.ali@tgmanager-demo.com'],
          title: 'Safety Protocol 2026',
          type: 'GENERAL',
          metadata: { version: '1.0', pages: 18 },
        },
        {
          tenantId: demoTenant.id,
          branchId: abuja.id,
          createdByUserId: userMap['tunde.ibrahim@tgmanager-demo.com'],
          title: 'Q3 Financial Report',
          type: 'GENERAL',
          metadata: { quarter: 'Q3 2026', pages: 12 },
        },
      ],
    });
    console.log('    ✓ 3 documents');

    // ── 19. Conversations & Messages ────────────────────────────────────
    // Direct: Admin ↔ Ada
    const directConv = await tx.conversation.create({
      data: {
        tenantId: demoTenant.id,
        type: 'DIRECT',
        createdByUserId: adminId,
      },
    });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: directConv.id, userId: adminId },
        {
          conversationId: directConv.id,
          userId: userMap['ada.okafor@tgmanager-demo.com'],
        },
      ],
    });
    await Promise.all([
      tx.message.create({
        data: {
          conversationId: directConv.id,
          senderId: adminId,
          body: 'Hi Ada, how is the Lagos branch doing this week?',
        },
      }),
      tx.message.create({
        data: {
          conversationId: directConv.id,
          senderId: userMap['ada.okafor@tgmanager-demo.com'],
          body: 'Going well! We onboarded two new engineers and the solar installation project is on track.',
        },
      }),
    ]);

    // Group: Senior Team
    const groupConv = await tx.conversation.create({
      data: {
        tenantId: demoTenant.id,
        type: 'GROUP',
        name: 'Senior Team',
        createdByUserId: adminId,
      },
    });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: groupConv.id, userId: adminId },
        {
          conversationId: groupConv.id,
          userId: userMap['ada.okafor@tgmanager-demo.com'],
        },
        {
          conversationId: groupConv.id,
          userId: userMap['james.balogun@tgmanager-demo.com'],
        },
      ],
    });
    await tx.message.createMany({
      data: [
        {
          conversationId: groupConv.id,
          senderId: adminId,
          body: "Team sync: let's review the Q3 targets this Friday.",
        },
        {
          conversationId: groupConv.id,
          senderId: userMap['ada.okafor@tgmanager-demo.com'],
          body: 'Sounds good. I have the branch reports ready.',
        },
        {
          conversationId: groupConv.id,
          senderId: userMap['james.balogun@tgmanager-demo.com'],
          body: 'I will present the engineering roadmap update as well.',
        },
      ],
    });
    console.log('    ✓ 2 conversations with 5 messages');

    // ── 20. Notifications ───────────────────────────────────────────────
    await tx.notification.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          userId: adminId,
          type: 'SYSTEM',
          title: 'Welcome aboard',
          body: 'Your demo organisation has been set up. Start by clocking in!',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['sade.adeyemi@tgmanager-demo.com'],
          type: 'WORKFLOW',
          title: 'Leave approved',
          body: 'Your leave request for Aug 25–29 has been approved.',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['bola.ogundimu@tgmanager-demo.com'],
          type: 'WORKFLOW',
          title: 'Leave pending review',
          body: 'Your leave request for Sep 10–12 is awaiting manager approval.',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['kunle.fashola@tgmanager-demo.com'],
          type: 'WORKFLOW',
          title: 'Expense approved',
          body: 'Your ₦45,000 expense claim has been reimbursed.',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['chidi.obi@tgmanager-demo.com'],
          type: 'WORKFLOW',
          title: 'Expense rejected',
          body: 'Your ₦120,000 expense claim was rejected. Reason: Over budget.',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['grace.ekpo@tgmanager-demo.com'],
          type: 'WORKFLOW',
          title: 'Pending approval',
          body: "Bola Ogundimu's leave request is waiting for your review.",
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['ada.okafor@tgmanager-demo.com'],
          type: 'SYSTEM',
          title: 'Schedule updated',
          body: 'The Lagos branch schedule has been updated for Q3.',
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['fatima.ali@tgmanager-demo.com'],
          type: 'MEMO',
          title: 'New memo published',
          body: 'Office Renovation Notice has been published company-wide.',
        },
      ],
    });
    console.log('    ✓ 8 notifications');

    // ── 21. Audit Logs ──────────────────────────────────────────────────
    await tx.auditLog.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          userId: adminId,
          action: 'user.created',
          entityType: 'User',
          entityId: adminId,
          metadata: { email: adminId },
        },
        {
          tenantId: demoTenant.id,
          userId: adminId,
          action: 'tenant.created',
          entityType: 'Tenant',
          entityId: demoTenant.id,
          metadata: { name: 'TGManager Demo Co.' },
        },
        {
          tenantId: demoTenant.id,
          userId: adminId,
          action: 'form.created',
          entityType: 'Form',
          entityId: leaveForm.id,
          metadata: { name: 'Leave Request' },
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['sade.adeyemi@tgmanager-demo.com'],
          action: 'workflow.submitted',
          entityType: 'WorkflowInstance',
          entityId: wfLeaveApproved.id,
          metadata: { title: 'Leave — Sade Adeyemi' },
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['sade.adeyemi@tgmanager-demo.com'],
          action: 'attendance.clock_in',
          entityType: 'Attendance',
          metadata: { branch: 'Head Office', time: '08:05' },
        },
        {
          tenantId: demoTenant.id,
          userId: userMap['kunle.fashola@tgmanager-demo.com'],
          action: 'workflow.submitted',
          entityType: 'WorkflowInstance',
          entityId: wfExpenseApproved.id,
          metadata: { title: 'Expense — Kunle Fashola', amount: 45000 },
        },
      ],
    });
    console.log('    ✓ 6 audit logs');

    // ── 22. Attendance (past 10 business days) ──────────────────────────
    const today = new Date(2026, 7, 26); // Aug 26 2026
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 14); // go back far enough to cover 10 business days
    const businessDays = weekdayRange(tenDaysAgo, today).slice(-10); // last 10

    // Staff who need attendance: all demo users with staff records in the demo org
    const attendanceStaff = staffRecords
      .filter((sr) => sr.tenantId === demoTenant.id)
      .map((sr) => ({
        email: sr.userId, // actually the userId
        branchId: sr.branchId,
        staffRecordId: staffByEmail[sr.userId],
      }));

    const attendanceData: {
      tenantId: string;
      userId: string;
      branchId: string;
      staffRecordId: string;
      date: Date;
      clockInAt: Date | null;
      clockOutAt: Date | null;
      clockInLat: number | null;
      clockInLng: number | null;
      clockOutLat: number | null;
      clockOutLng: number | null;
      status:
        | 'ON_TIME'
        | 'LATE'
        | 'EARLY_LEAVE'
        | 'OVERTIME'
        | 'NO_CLOCK_OUT'
        | 'ABSENT';
    }[] = [];

    // Deterministic patterns per user index
    const branchCoords: Record<string, { lat: number; lng: number }> = {
      [lagos.id]: { lat: 6.5244, lng: 3.3792 },
      [abuja.id]: { lat: 9.0579, lng: 7.4951 },
      [ph.id]: { lat: 4.8156, lng: 7.0498 },
    };

    for (let dayIdx = 0; dayIdx < businessDays.length; dayIdx++) {
      const day = businessDays[dayIdx];
      for (let staffIdx = 0; staffIdx < attendanceStaff.length; staffIdx++) {
        const s = attendanceStaff[staffIdx];
        const coords = branchCoords[s.branchId] ?? branchCoords[lagos.id];
        const userHash = (staffIdx * 7 + dayIdx * 3) % 20;

        // User 13 (index 12, Sunshine) gets no attendance in demo org
        if (s.email === userMap['sunshine@demo.com']) continue;

        let status: (typeof attendanceData)[number]['status'];
        let clockInAt: Date | null;
        let clockOutAt: Date | null;

        if (userHash === 0) {
          // Absent
          status = 'ABSENT';
          clockInAt = null;
          clockOutAt = null;
        } else if (userHash <= 2) {
          // Late
          status = 'LATE';
          clockInAt = new Date(day);
          clockInAt.setHours(8, 25 + userHash * 5, 0);
          clockOutAt = new Date(day);
          clockOutAt.setHours(17, 0, 0);
        } else if (userHash <= 4) {
          // Early leave
          status = 'EARLY_LEAVE';
          clockInAt = new Date(day);
          clockInAt.setHours(7, 55, 0);
          clockOutAt = new Date(day);
          clockOutAt.setHours(15, 30, 0);
        } else if (userHash <= 6) {
          // Overtime
          status = 'OVERTIME';
          clockInAt = new Date(day);
          clockInAt.setHours(7, 50, 0);
          clockOutAt = new Date(day);
          clockOutAt.setHours(18, 15, 0);
        } else if (userHash <= 14) {
          // On time
          status = 'ON_TIME';
          clockInAt = new Date(day);
          clockInAt.setHours(7, 50 + (userHash % 10), 0);
          clockOutAt = new Date(day);
          clockOutAt.setHours(17, 0 + (userHash % 5), 0);
        } else {
          // No clock out
          status = 'NO_CLOCK_OUT';
          clockInAt = new Date(day);
          clockInAt.setHours(8, 0, 0);
          clockOutAt = null;
        }

        attendanceData.push({
          tenantId: demoTenant.id,
          userId: s.email,
          branchId: s.branchId,
          staffRecordId: s.staffRecordId,
          date: day,
          clockInAt,
          clockOutAt,
          clockInLat: clockInAt
            ? coords.lat + (Math.random() - 0.5) * 0.001
            : null,
          clockInLng: clockInAt
            ? coords.lng + (Math.random() - 0.5) * 0.001
            : null,
          clockOutLat: clockOutAt
            ? coords.lat + (Math.random() - 0.5) * 0.001
            : null,
          clockOutLng: clockOutAt
            ? coords.lng + (Math.random() - 0.5) * 0.001
            : null,
          status,
        });
      }
    }

    // Use createMany for performance (Attendance has no extra required fields beyond what we provide)
    // Split into chunks of 50 to avoid parameter limits
    for (let i = 0; i < attendanceData.length; i += 50) {
      await tx.attendance.createMany({ data: attendanceData.slice(i, i + 50) });
    }
    console.log(
      `    ✓ ${attendanceData.length} attendance records over ${businessDays.length} days`,
    );

    console.log(`\n✅ Demo org seeded successfully!`);
    console.log(`   Tenant: ${demoTenant.name} (${demoTenant.id})`);
    console.log(
      `   Sunshine: ${sunshineTenant.name} (${sunshineTenant.id}) — SUSPENDED`,
    );
    console.log(`   Users: ${allUsers.length}`);
    console.log(`   Branches: ${branches.length}`);
    console.log(`   Staff records: ${createdStaffRecords.length}`);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export interface SeedRun {
  plansSeeded: boolean;
  demoSeeded: boolean;
}

/**
 * Runs the database seed against the given Prisma client.
 * - Plans are always upserted (idempotent).
 * - The demo organisation is skipped in production unless SEED_DEMO=true,
 *   and skipped entirely if the demo tenant already exists.
 */
export async function runSeed(prisma: PrismaClient): Promise<SeedRun> {
  await seedPlans(prisma);
  const demoSeeded = await seedDemoOrg(prisma);
  return { plansSeeded: true, demoSeeded };
}
