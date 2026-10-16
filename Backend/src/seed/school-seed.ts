import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
} from '../modules/rbac/permissions/permissions.constants';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../modules/rbac/system-roles/system-roles.constants';
import { DEFAULT_PASSWORD } from '../common/default-password.constants';

const BCRYPT_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

export async function seedSchoolDemo(prisma: PrismaClient): Promise<boolean> {
  const existingSchool = await prisma.tenant.findUnique({
    where: { slug: 'tgeasy-model-college' },
  });

  if (existingSchool) {
    console.log('   Demo school (TGEasy Model College) already exists. Skipping.');
    return false;
  }

  const freePlan =
    (await prisma.plan.findUnique({ where: { code: 'enterprise' } })) ||
    (await prisma.plan.findUnique({ where: { code: 'free' } }));

  if (!freePlan) {
    console.log('   No plan found to attach demo school. Skipping.');
    return false;
  }

  console.log('   Creating demo school: TGEasy Model College...');

  return prisma.$transaction(
    async (tx) => {
      // 1. Create School Tenant
      const schoolTenant = await tx.tenant.create({
        data: {
          name: 'TGEasy Model College',
          slug: 'tgeasy-model-college',
          type: 'SCHOOL',
          planId: freePlan.id,
          onboardingStatus: 'COMPLETED',
          timezone: 'Africa/Lagos',
          settings: {
            theme: { primaryColor: '#0ea5e9' },
            schoolMotto: 'Knowledge, Integrity and Excellence',
            currency: 'NGN',
          },
        },
      });

      // 2. School Profile
      await tx.schoolProfile.create({
        data: {
          tenantId: schoolTenant.id,
          motto: 'Knowledge, Integrity and Excellence',
          principalName: 'Dr. Kingsley Adeyemi',
          schoolType: 'SECONDARY',
          ownershipType: 'PRIVATE',
          currency: 'NGN',
          openingTime: '07:30',
          lateThreshold: '07:50',
          geofenceRadius: 300,
          latitude: 6.5954,
          longitude: 3.3431,
          address: 'Plot 14, Commercial Avenue, Ikeja',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
          phone: '+234 802 345 6789',
          email: 'info@tgeasymodel.edu.ng',
          website: 'https://tgeasymodel.edu.ng',
        },
      });

      // 3. Branches / Campuses
      const ikejaBranch = await tx.branch.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Main Campus (Ikeja)',
          address: 'Plot 14, Commercial Avenue, Ikeja, Lagos',
          latitude: 6.5954,
          longitude: 3.3431,
          radiusMeters: 250,
          status: 'ACTIVE',
        },
      });

      const abujaBranch = await tx.branch.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Abuja Annex (Garki)',
          address: 'Area 11, Garki, Abuja FCT',
          latitude: 9.0354,
          longitude: 7.4891,
          radiusMeters: 250,
          status: 'ACTIVE',
        },
      });

      // 4. Gates
      const mainGate = await tx.gate.create({
        data: {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          name: 'Main Entrance Gate',
          code: 'GATE-01',
          location: 'Front Security Checkpoint A',
          latitude: 6.5954,
          longitude: 3.3431,
          radiusMeters: 150,
        },
      });

      await tx.gate.create({
        data: {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          name: 'Bus & Staff Gate',
          code: 'GATE-02',
          location: 'North Campus Gate B',
          latitude: 6.5971,
          longitude: 3.3449,
          radiusMeters: 150,
        },
      });

      // 5. Create System Roles
      const adminRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.COMPANY_ADMIN,
          description: SYSTEM_ROLE_DEFS.COMPANY_ADMIN.description,
          isSystem: true,
          permissions: [...ALL_PERMISSIONS],
        },
      });

      const principalRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.PRINCIPAL,
          description: SYSTEM_ROLE_DEFS.PRINCIPAL.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.PRINCIPAL.permissions],
        },
      });

      const teacherRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.TEACHER,
          description: SYSTEM_ROLE_DEFS.TEACHER.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.TEACHER.permissions],
        },
      });

      const accountantRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.ACCOUNTANT,
          description: SYSTEM_ROLE_DEFS.ACCOUNTANT.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.ACCOUNTANT.permissions],
        },
      });

      const gateOfficerRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.GATE_OFFICER,
          description: SYSTEM_ROLE_DEFS.GATE_OFFICER.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.GATE_OFFICER.permissions],
        },
      });

      const parentRole = await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.PARENT,
          description: SYSTEM_ROLE_DEFS.PARENT.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.PARENT.permissions],
        },
      });

      await tx.companyRole.create({
        data: {
          tenantId: schoolTenant.id,
          name: SYSTEM_ROLE_NAMES.STUDENT,
          description: SYSTEM_ROLE_DEFS.STUDENT.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.STUDENT.permissions],
        },
      });

      // Helper to register staff user
      const createStaffUser = async (
        email: string,
        firstName: string,
        lastName: string,
        roleId: string,
        designation: string,
        category: 'TEACHER' | 'ADMINISTRATOR' | 'ACCOUNTANT' | 'GATE_OFFICER' = 'TEACHER',
      ) => {
        let user = await tx.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) {
          user = await tx.user.create({
            data: {
              email: email.toLowerCase(),
              firstName,
              lastName,
              passwordHash: BCRYPT_HASH,
              role: 'USER',
            },
          });
        }
        await tx.tenantUser.create({
          data: { tenantId: schoolTenant.id, userId: user.id },
        });
        await tx.roleAssignment.create({
          data: { tenantId: schoolTenant.id, userId: user.id, companyRoleId: roleId },
        });
        const staff = await tx.schoolStaff.create({
          data: {
            tenantId: schoolTenant.id,
            userId: user.id,
            employeeNumber: `STF-${Math.floor(1000 + Math.random() * 9000)}`,
            firstName,
            lastName,
            designation,
            category,
            department: category === 'TEACHER' ? 'Academics' : 'Administration',
            phone: '+234 800 123 4567',
            email: email.toLowerCase(),
          },
        });
        return { user, staff };
      };

      // 6. Create Staff Accounts
      const principal = await createStaffUser(
        'principal@tgeasymodel.edu.ng',
        'Kingsley',
        'Adeyemi',
        principalRole.id,
        'Principal / Headmaster',
        'ADMINISTRATOR',
      );

      const admin = await createStaffUser(
        'admin@tgeasymodel.edu.ng',
        'Folake',
        'Balogun',
        adminRole.id,
        'School Administrator',
        'ADMINISTRATOR',
      );

      const teacherMath = await createStaffUser(
        'teacher.math@tgeasymodel.edu.ng',
        'Babatunde',
        'Okafor',
        teacherRole.id,
        'Senior Mathematics Teacher',
        'TEACHER',
      );

      const teacherEng = await createStaffUser(
        'teacher.eng@tgeasymodel.edu.ng',
        'Ngozi',
        'Adeleke',
        teacherRole.id,
        'Head of English & Literature',
        'TEACHER',
      );

      const teacherSci = await createStaffUser(
        'teacher.sci@tgeasymodel.edu.ng',
        'Emeka',
        'Nnamdi',
        teacherRole.id,
        'Physics & Science Instructor',
        'TEACHER',
      );

      const teacherBio = await createStaffUser(
        'teacher.bio@tgeasymodel.edu.ng',
        'Amina',
        'Yusuf',
        teacherRole.id,
        'Biology & Agric Science Teacher',
        'TEACHER',
      );

      const teacherEcon = await createStaffUser(
        'teacher.econ@tgeasymodel.edu.ng',
        'Segun',
        'Alabi',
        teacherRole.id,
        'Economics & Civic Teacher',
        'TEACHER',
      );

      const bursar = await createStaffUser(
        'bursar@tgeasymodel.edu.ng',
        'Chinedu',
        'Obi',
        accountantRole.id,
        'School Bursar / Chief Accountant',
        'ACCOUNTANT',
      );

      await createStaffUser(
        'gate.musa@tgeasymodel.edu.ng',
        'Musa',
        'Ibrahim',
        gateOfficerRole.id,
        'Head Gate Security Officer',
        'GATE_OFFICER',
      );

      await createStaffUser(
        'gate.yakubu@tgeasymodel.edu.ng',
        'Yakubu',
        'Danjuma',
        gateOfficerRole.id,
        'Gate Officer Checkpoint B',
        'GATE_OFFICER',
      );

      // 7. Academic Session & Terms
      const session2526 = await tx.academicSession.create({
        data: {
          tenantId: schoolTenant.id,
          name: '2025/2026 Academic Session',
          isCurrent: true,
          startDate: new Date('2025-09-08'),
          endDate: new Date('2026-07-24'),
        },
      });

      await tx.term.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: '1st Term',
          isCurrent: false,
          status: 'COMPLETED',
          resultPublished: true,
          startDate: new Date('2025-09-08'),
          endDate: new Date('2025-12-19'),
        },
      });

      const term2 = await tx.term.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: '2nd Term',
          isCurrent: true,
          status: 'ACTIVE',
          resultEntryOpen: true,
          startDate: new Date('2026-01-12'),
          endDate: new Date('2026-04-10'),
        },
      });

      await tx.term.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: '3rd Term',
          isCurrent: false,
          status: 'UPCOMING',
          startDate: new Date('2026-04-27'),
          endDate: new Date('2026-07-24'),
        },
      });

      // 8. Class Rooms
      const jss1A = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'JSS 1 Gold',
          level: 'JSS 1',
          section: 'Gold',
          capacity: 35,
          classTeacherId: teacherMath.staff.id,
        },
      });

      const jss1B = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'JSS 1 Silver',
          level: 'JSS 1',
          section: 'Silver',
          capacity: 35,
          classTeacherId: teacherEng.staff.id,
        },
      });

      const jss2A = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'JSS 2 Diamond',
          level: 'JSS 2',
          section: 'Diamond',
          capacity: 35,
          classTeacherId: teacherBio.staff.id,
        },
      });

      const sss1Sci = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'SSS 1 Science',
          level: 'SSS 1',
          section: 'Science',
          capacity: 30,
          classTeacherId: teacherSci.staff.id,
        },
      });

      const sss2Sci = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'SSS 2 Science',
          level: 'SSS 2',
          section: 'Science',
          capacity: 30,
          classTeacherId: teacherMath.staff.id,
        },
      });

      const sss3Arts = await tx.classRoom.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          name: 'SSS 3 Arts',
          level: 'SSS 3',
          section: 'Arts',
          capacity: 30,
          classTeacherId: teacherEcon.staff.id,
        },
      });

      const classes = [jss1A, jss1B, jss2A, sss1Sci, sss2Sci, sss3Arts];

      // 9. Subjects
      const math = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Mathematics',
          code: 'MTH101',
          category: 'CORE',
        },
      });

      const english = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'English Language',
          code: 'ENG101',
          category: 'CORE',
        },
      });

      const basicSci = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Basic Science',
          code: 'BSC101',
          category: 'SCIENCE',
        },
      });

      const physics = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Physics',
          code: 'PHY201',
          category: 'SCIENCE',
        },
      });

      const chemistry = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Chemistry',
          code: 'CHM201',
          category: 'SCIENCE',
        },
      });

      const biology = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Biology',
          code: 'BIO101',
          category: 'SCIENCE',
        },
      });

      const economics = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Economics',
          code: 'ECN301',
          category: 'COMMERCIAL',
        },
      });

      const civic = await tx.subject.create({
        data: {
          tenantId: schoolTenant.id,
          name: 'Civic Education',
          code: 'CVE101',
          category: 'CORE',
        },
      });

      const subjects = [math, english, basicSci, physics, chemistry, biology, economics, civic];

      // Assign Subjects to classes in a single batch
      const classSubjectData = [];
      for (const cls of classes) {
        for (const sub of subjects) {
          classSubjectData.push({
            tenantId: schoolTenant.id,
            classId: cls.id,
            subjectId: sub.id,
          });
        }
      }
      await tx.classSubject.createMany({ data: classSubjectData });

      // 10. Grading Scales & Assessment Components
      await tx.gradingScale.createMany({
        data: [
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'A1', minScore: 75, maxScore: 100, remark: 'Excellent', gradePoint: 5.0 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'B2', minScore: 70, maxScore: 74, remark: 'Very Good', gradePoint: 4.5 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'B3', minScore: 65, maxScore: 69, remark: 'Good', gradePoint: 4.0 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'C4', minScore: 60, maxScore: 64, remark: 'Credit', gradePoint: 3.5 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'C5', minScore: 55, maxScore: 59, remark: 'Credit', gradePoint: 3.0 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'C6', minScore: 50, maxScore: 54, remark: 'Credit', gradePoint: 2.5 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'D7', minScore: 45, maxScore: 49, remark: 'Pass', gradePoint: 2.0 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'E8', minScore: 40, maxScore: 44, remark: 'Pass', gradePoint: 1.5 },
          { tenantId: schoolTenant.id, name: 'WAEC Scale', grade: 'F9', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: 0.0 },
        ],
      });

      await tx.assessmentComponent.createMany({
        data: [
          {
            tenantId: schoolTenant.id,
            name: '1st Continuous Assessment (CA 1)',
            maxScore: 20,
            weightPercent: 20,
          },
          {
            tenantId: schoolTenant.id,
            name: '2nd Continuous Assessment (CA 2)',
            maxScore: 20,
            weightPercent: 20,
          },
          {
            tenantId: schoolTenant.id,
            name: 'Term Examination',
            maxScore: 60,
            weightPercent: 60,
          },
        ],
      });

      // 11. Fee Structures
      const tuitionFee = await tx.feeStructure.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          termId: term2.id,
          name: 'Term 2 Tuition Fee',
          amount: 85000,
          category: 'TUITION',
        },
      });

      const ictFee = await tx.feeStructure.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          termId: term2.id,
          name: 'Computer Lab & ICT Levy',
          amount: 15000,
          category: 'FACILITIES',
        },
      });

      const devLevy = await tx.feeStructure.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          termId: term2.id,
          name: 'School Development Levy',
          amount: 10000,
          category: 'DEVELOPMENT',
        },
      });

      await tx.feeStructure.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          termId: term2.id,
          name: 'Library & Reading Materials Levy',
          amount: 5000,
          category: 'LIBRARY',
        },
      });

      await tx.feeStructure.create({
        data: {
          tenantId: schoolTenant.id,
          sessionId: session2526.id,
          termId: term2.id,
          name: 'Sports & Extracurricular Levy',
          amount: 7500,
          category: 'SPORTS',
        },
      });

      // 12. 10 Parents / Guardians
      const guardianData = [
        { firstName: 'Chukwudi', lastName: 'Eze', phone: '+234 803 111 2233', email: 'c.eze@gmail.com', rel: 'Father' },
        { firstName: 'Fatima', lastName: 'Bello', phone: '+234 802 222 3344', email: 'fatima.bello@yahoo.com', rel: 'Mother' },
        { firstName: 'Adekunle', lastName: 'Adeyemo', phone: '+234 805 333 4455', email: 'ade.adeyemo@gmail.com', rel: 'Father' },
        { firstName: 'Ngozi', lastName: 'Okonjo', phone: '+234 808 444 5566', email: 'ngozi.okonjo@hotmail.com', rel: 'Mother' },
        { firstName: 'Ibrahim', lastName: 'Danjuma', phone: '+234 809 555 6677', email: 'i.danjuma@gmail.com', rel: 'Father' },
        { firstName: 'Oluwaseun', lastName: 'Adeleke', phone: '+234 812 666 7788', email: 'seun.adeleke@yahoo.com', rel: 'Father' },
        { firstName: 'Blessing', lastName: 'Nwosu', phone: '+234 813 777 8899', email: 'blessing.nwosu@gmail.com', rel: 'Mother' },
        { firstName: 'Tunde', lastName: 'Bakare', phone: '+234 814 888 9900', email: 'tunde.bakare@gmail.com', rel: 'Father' },
        { firstName: 'Aisha', lastName: 'Garba', phone: '+234 816 999 0011', email: 'aisha.garba@yahoo.com', rel: 'Mother' },
        { firstName: 'Emeka', lastName: 'Okafor', phone: '+234 817 000 1122', email: 'emeka.okafor@gmail.com', rel: 'Father' },
      ];

      const guardians = [];
      for (const g of guardianData) {
        const guardian = await tx.guardian.create({
          data: {
            tenantId: schoolTenant.id,
            firstName: g.firstName,
            lastName: g.lastName,
            phone: g.phone,
            email: g.email,
            address: 'Lagos, Nigeria',
            occupation: 'Business Executive / Professional',
          },
        });
        guardians.push({ guardian, rel: g.rel });
      }

      // 12b. Demo parent-portal account linked to the first guardian (Chukwudi Eze)
      const demoGuardian = guardians[0].guardian;
      const demoParentEmail = 'parent.demo@tgmanager.dev';
      let demoParentUser = await tx.user.findUnique({
        where: { email: demoParentEmail },
      });
      if (!demoParentUser) {
        demoParentUser = await tx.user.create({
          data: {
            email: demoParentEmail,
            firstName: demoGuardian.firstName,
            lastName: demoGuardian.lastName,
            passwordHash: BCRYPT_HASH,
            role: 'USER',
          },
        });
      }
      await tx.tenantUser.create({
        data: { tenantId: schoolTenant.id, userId: demoParentUser.id },
      });
      await tx.roleAssignment.create({
        data: {
          tenantId: schoolTenant.id,
          userId: demoParentUser.id,
          companyRoleId: parentRole.id,
        },
      });
      await tx.guardian.update({
        where: { id: demoGuardian.id },
        data: { userId: demoParentUser.id },
      });

      // 13. 30 Students across classes
      const studentNames = [
        { first: 'Chinedu', last: 'Eze', gender: 'MALE', dob: '2012-05-14' },
        { first: 'Adaeze', last: 'Eze', gender: 'FEMALE', dob: '2014-08-20' },
        { first: 'Zainab', last: 'Bello', gender: 'FEMALE', dob: '2013-03-10' },
        { first: 'Usman', last: 'Bello', gender: 'MALE', dob: '2011-11-25' },
        { first: 'Femi', last: 'Adeyemo', gender: 'MALE', dob: '2012-01-18' },
        { first: 'Tiwa', last: 'Adeyemo', gender: 'FEMALE', dob: '2014-04-09' },
        { first: 'Somto', last: 'Okonjo', gender: 'MALE', dob: '2010-09-02' },
        { first: 'Chiamaka', last: 'Okonjo', gender: 'FEMALE', dob: '2012-12-14' },
        { first: 'Aliyu', last: 'Danjuma', gender: 'MALE', dob: '2011-06-30' },
        { first: 'Maryam', last: 'Danjuma', gender: 'FEMALE', dob: '2013-02-12' },
        { first: 'David', last: 'Adeleke', gender: 'MALE', dob: '2010-07-19' },
        { first: 'Sharon', last: 'Adeleke', gender: 'FEMALE', dob: '2013-10-05' },
        { first: 'Kelechi', last: 'Nwosu', gender: 'MALE', dob: '2011-04-16' },
        { first: 'Chidinma', last: 'Nwosu', gender: 'FEMALE', dob: '2014-01-22' },
        { first: 'Ayomide', last: 'Bakare', gender: 'MALE', dob: '2010-03-11' },
        { first: 'Boluwatife', last: 'Bakare', gender: 'FEMALE', dob: '2012-09-08' },
        { first: 'Halima', last: 'Garba', gender: 'FEMALE', dob: '2011-08-15' },
        { first: 'Kabir', last: 'Garba', gender: 'MALE', dob: '2013-05-29' },
        { first: 'Obinna', last: 'Okafor', gender: 'MALE', dob: '2010-12-04' },
        { first: 'Nneka', last: 'Okafor', gender: 'FEMALE', dob: '2012-07-17' },
        { first: 'Tobi', last: 'Alade', gender: 'MALE', dob: '2011-02-28' },
        { first: 'Simi', last: 'Alade', gender: 'FEMALE', dob: '2013-11-14' },
        { first: 'Ifeanyi', last: 'Ugwu', gender: 'MALE', dob: '2010-10-21' },
        { first: 'Amarachi', last: 'Ugwu', gender: 'FEMALE', dob: '2014-06-03' },
        { first: 'Kareem', last: 'Suleiman', gender: 'MALE', dob: '2012-08-19' },
        { first: 'Fatimah', last: 'Suleiman', gender: 'FEMALE', dob: '2014-02-24' },
        { first: 'Olamide', last: 'Balogun', gender: 'MALE', dob: '2010-05-12' },
        { first: 'Eniola', last: 'Balogun', gender: 'FEMALE', dob: '2012-03-31' },
        { first: 'Victor', last: 'Osimhen', gender: 'MALE', dob: '2010-11-11' },
        { first: 'Grace', last: 'Osimhen', gender: 'FEMALE', dob: '2013-09-17' },
      ];

      const createdStudents = [];
      const studentGuardianData = [];
      const idCardData = [];

      // Match guardians to students by surname so each linked family lines up.
      // (The demo parent-portal account is the "Eze" guardian, which means his
      // children in the portal are Chinedu Eze and Adaeze Eze.)
      const guardianBySurname = new Map<string, (typeof guardians)[number]>();
      for (const g of guardians) {
        const key = g.guardian.lastName.trim().toLowerCase();
        if (!guardianBySurname.has(key)) guardianBySurname.set(key, g);
      }

      for (let i = 0; i < studentNames.length; i++) {
        const s = studentNames[i];
        const assignedClass = classes[i % classes.length];
        const admissionNum = `TMC/2025/${String(i + 1).padStart(3, '0')}`;
        const qrId = `STU-QR-${schoolTenant.slug}-${String(i + 1).padStart(4, '0')}`;

        const student = await tx.student.create({
          data: {
            tenantId: schoolTenant.id,
            branchId: ikejaBranch.id,
            admissionNumber: admissionNum,
            qrIdentifier: qrId,
            firstName: s.first,
            lastName: s.last,
            gender: s.gender,
            dateOfBirth: new Date(s.dob),
            currentClassId: assignedClass.id,
            bloodGroup: i % 2 === 0 ? 'O+' : 'A+',
            genotype: i % 4 === 0 ? 'AS' : 'AA',
            phone: '+234 803 000 0000',
            address: 'Lagos Mainland, Nigeria',
            status: 'ACTIVE',
          },
        });

        createdStudents.push(student);

        // Prep student guardian (prefer a surname match for coherent demo data)
        const gInfo =
          guardianBySurname.get(s.last.trim().toLowerCase()) ??
          guardians[i % guardians.length];
        studentGuardianData.push({
          studentId: student.id,
          guardianId: gInfo.guardian.id,
          relationship: gInfo.rel,
          isPrimary: true,
          emergencyContact: true,
        });

        // Prep ID card
        idCardData.push({
          tenantId: schoolTenant.id,
          studentId: student.id,
          cardNumber: `CARD-TMC-${10000 + i}`,
          qrPayload: qrId,
          expiresAt: new Date('2026-08-31'),
          status: 'ACTIVE',
        });
      }

      // Batch insert student guardians and ID cards
      await tx.studentGuardian.createMany({ data: studentGuardianData });
      await tx.studentIdCard.createMany({ data: idCardData });

      // 14. Batch Gate Attendance Records for Today & Yesterday
      const today = new Date();
      const morningCheckIn = new Date(today);
      morningCheckIn.setHours(7, 35, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yMorning = new Date(yesterday);
      yMorning.setHours(7, 40, 0, 0);
      const yAfternoon = new Date(yesterday);
      yAfternoon.setHours(15, 30, 0, 0);

      const attendanceBatch = [];
      for (let i = 0; i < createdStudents.length; i++) {
        const stu = createdStudents[i];
        const isLate = i % 5 === 0;
        const checkIn = new Date(morningCheckIn.getTime() + i * 45000);
        if (isLate) {
          checkIn.setHours(7, 55, 0, 0);
        }

        attendanceBatch.push({
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          gateId: mainGate.id,
          studentId: stu.id,
          date: today,
          checkInTime: checkIn,
          status: isLate ? ('LATE' as const) : ('PRESENT' as const),
          method: 'ID_CARD' as const,
          notes: isLate ? 'Arrived after 7:50 AM cutoff' : 'On-time arrival',
        });

        attendanceBatch.push({
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          gateId: mainGate.id,
          studentId: stu.id,
          date: yesterday,
          checkInTime: yMorning,
          checkOutTime: yAfternoon,
          status: 'PRESENT' as const,
          method: 'ID_CARD' as const,
          notes: 'Completed full school day',
        });
      }
      await tx.schoolAttendance.createMany({ data: attendanceBatch });

      // 14b. Staff clock-in/out records (today & yesterday) for the demo
      const staffClockIn = (h: number, m: number) => {
        const d = new Date(today);
        d.setHours(h, m, 0, 0);
        return d;
      };
      const yClock = (h: number, m: number) => {
        const d = new Date(yesterday);
        d.setHours(h, m, 0, 0);
        return d;
      };
      const staffAttendanceBatch = [
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: principal.staff.id,
          date: today,
          clockInAt: staffClockIn(7, 20),
          clockInLat: 6.5954,
          clockInLng: 3.3431,
          status: 'ON_TIME' as const,
          method: 'WEB',
          recordedByUserId: principal.user.id,
        },
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: teacherMath.staff.id,
          date: today,
          clockInAt: staffClockIn(7, 38),
          clockInLat: 6.5955,
          clockInLng: 3.3432,
          status: 'ON_TIME' as const,
          method: 'WEB',
          recordedByUserId: teacherMath.user.id,
        },
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: teacherEng.staff.id,
          date: today,
          clockInAt: staffClockIn(8, 12),
          clockInLat: 6.5967,
          clockInLng: 3.344,
          status: 'LATE' as const,
          lateMinutes: 22,
          method: 'WEB',
          note: 'Heavy traffic on Awolowo Way',
          recordedByUserId: teacherEng.user.id,
        },
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: bursar.staff.id,
          date: today,
          clockInAt: staffClockIn(7, 45),
          clockInLat: 6.5954,
          clockInLng: 3.3431,
          status: 'ON_TIME' as const,
          method: 'WEB',
          recordedByUserId: bursar.user.id,
        },
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: teacherMath.staff.id,
          date: yesterday,
          clockInAt: yClock(7, 30),
          clockOutAt: yClock(15, 45),
          status: 'ON_TIME' as const,
          method: 'WEB',
          recordedByUserId: teacherMath.user.id,
        },
        {
          tenantId: schoolTenant.id,
          branchId: ikejaBranch.id,
          schoolStaffId: teacherEng.staff.id,
          date: yesterday,
          clockInAt: yClock(7, 35),
          clockOutAt: yClock(15, 40),
          status: 'ON_TIME' as const,
          method: 'WEB',
          recordedByUserId: teacherEng.user.id,
        },
      ];
      await tx.schoolStaffAttendance.createMany({ data: staffAttendanceBatch });

      // 15. Term results are seeded comprehensively (every student × every
      // class subject, across all started terms) by `seedSchoolResults` after
      // this function returns, so they can also back-fill an existing demo
      // school. See `src/seed/school-results-seed.ts`.

      // 16. Fee Invoices & Payments
      for (let i = 0; i < createdStudents.length; i++) {
        const stu = createdStudents[i];
        const invoiceNum = `INV-2026-T2-${String(i + 1).padStart(3, '0')}`;
        const totalAmount = 85000 + 15000 + 10000; // ₦110,000

        const isFullyPaid = i % 3 === 0;
        const isPartiallyPaid = i % 3 === 1;
        const amountPaid = isFullyPaid ? totalAmount : isPartiallyPaid ? 60000 : 0;
        const balance = totalAmount - amountPaid;
        const paymentStatus = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'UNPAID';

        const invoice = await tx.studentInvoice.create({
          data: {
            tenantId: schoolTenant.id,
            studentId: stu.id,
            sessionId: session2526.id,
            termId: term2.id,
            invoiceNumber: invoiceNum,
            totalAmount,
            paidAmount: amountPaid,
            balance,
            status: paymentStatus as any,
            dueDate: new Date('2026-02-28'),
            items: {
              create: [
                { feeStructureId: tuitionFee.id, description: 'Term 2 Tuition Fee', amount: 85000 },
                { feeStructureId: ictFee.id, description: 'Computer Lab & ICT Levy', amount: 15000 },
                { feeStructureId: devLevy.id, description: 'School Development Levy', amount: 10000 },
              ],
            },
          },
        });

        if (amountPaid > 0) {
          // Record each instalment as its own payment so the payment count and
          // history are meaningful (some invoices paid once, some in two parts).
          const instalments =
            isFullyPaid || isPartiallyPaid
              ? [Math.round(amountPaid / 2), amountPaid - Math.round(amountPaid / 2)]
              : [];
          let instalmentIndex = 0;
          for (const part of instalments) {
            if (part <= 0) continue;
            instalmentIndex += 1;
            await tx.schoolPayment.create({
              data: {
                tenantId: schoolTenant.id,
                invoiceId: invoice.id,
                studentId: stu.id,
                receiptNumber: `REC-${202600 + i}-${instalmentIndex}`,
                amount: part,
                method: instalmentIndex === 1 ? 'BANK_TRANSFER' : 'POS',
                paymentReference: `TXN-NIBSS-${Math.floor(1000000 + Math.random() * 9000000)}`,
                recordedByUserId: bursar.user.id,
                notes: isFullyPaid
                  ? `Instalment ${instalmentIndex} of full term fees`
                  : `Instalment ${instalmentIndex} (part payment)`,
              },
            });
          }
        }
      }

      // 17. Announcements
      await tx.schoolAnnouncement.createMany({
        data: [
          {
            tenantId: schoolTenant.id,
            title: 'Welcome to the 2025/2026 Academic Session',
            content:
              'Dear Parents and Guardians, welcome back! We look forward to a great session of learning and character building.\n\n- The Administration',
            audience: 'ALL',
            publishedAt: new Date('2025-09-08T08:00:00.000Z'),
            createdByUserId: admin.user.id,
          },
          {
            tenantId: schoolTenant.id,
            title: '2nd Term Mid-Term Examination Timetable',
            content:
              'The 2nd Term mid-term examinations run from Monday 16 February to Friday 20 February 2026.\n\nStudents should revise their class notes and past continuous assessments. Parents are encouraged to monitor study time at home.',
            audience: 'STUDENTS',
            publishedAt: new Date('2026-02-02T09:00:00.000Z'),
            createdByUserId: principal.user.id,
          },
          {
            tenantId: schoolTenant.id,
            title: '2nd Term Fees: Payment Deadline 28 February 2026',
            content:
              'This is a reminder that all 2nd Term fees (tuition, ICT levy and development levy) are due by 28 February 2026.\n\nPayments can be made via bank transfer or at the bursary. Kindly present your receipts at the gate for updates to the portal.',
            audience: 'PARENTS',
            publishedAt: new Date('2026-01-20T10:00:00.000Z'),
            createdByUserId: bursar.user.id,
          },
          {
            tenantId: schoolTenant.id,
            title: 'Staff Inter-House Sports Day: Volunteers Needed',
            content:
              'The annual inter-house sports day holds on Friday 20 March 2026. We need teacher volunteers for the event coordination and house supervision committees.\n\nKindly register with the sports department before Friday 27 February.',
            audience: 'STAFF',
            publishedAt: new Date('2026-01-15T14:00:00.000Z'),
            createdByUserId: admin.user.id,
          },
        ],
      });
      console.log('   ✓ 4 school announcements');

      console.log('   Demo School (TGEasy Model College) seeded successfully!');
      console.log(`   Principal: principal@tgeasymodel.edu.ng (password: password123)`);
      console.log(`   Admin: admin@tgeasymodel.edu.ng (password: password123)`);
      console.log(`   Bursar: bursar@tgeasymodel.edu.ng (password: password123)`);
      console.log(`   Teachers: teacher.math@..., teacher.eng@... (password: password123)`);
      console.log(`   Parent Portal: parent.demo@tgmanager.dev (password: password123) — children: Chinedu Eze, Adaeze Eze`);
      console.log(`   Students: 30 students seeded with classes, attendance, grading & invoices.`);

      return true;
    },
    {
      timeout: 180000,
      maxWait: 30000,
    },
  );
}
