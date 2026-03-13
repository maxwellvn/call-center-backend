import "dotenv/config";

import { PrismaClient, UserRole, GoalMetricType, GoalOwnerType } from "@prisma/client";

import { currentWeekKey } from "../src/lib/week";

const prisma = new PrismaClient();

async function main() {
  const weekKey = currentWeekKey();
  const manager = await prisma.user.upsert({
    where: { email: "manager@callcenter.local" },
    update: {},
    create: {
      fullName: "Team Manager",
      email: "manager@callcenter.local",
      role: UserRole.MANAGER,
      title: "Call Centre Manager",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@callcenter.local" },
    update: {},
    create: {
      fullName: "System Admin",
      email: "admin@callcenter.local",
      role: UserRole.ADMIN,
      title: "Operations Admin",
    },
  });

  const rep = await prisma.user.upsert({
    where: { email: "rep@callcenter.local" },
    update: {},
    create: {
      fullName: "Grace Okon",
      email: "rep@callcenter.local",
      role: UserRole.REP,
      title: "Call Centre Representative",
    },
  });

  const group = await prisma.repGroup.upsert({
    where: { name: "General Reps" },
    update: { managerId: manager.id },
    create: {
      name: "General Reps",
      description: "Primary call centre team",
      managerId: manager.id,
    },
  });

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: rep.id, groupId: group.id } },
    update: {},
    create: { userId: rep.id, groupId: group.id },
  });

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: manager.id, groupId: group.id } },
    update: {},
    create: { userId: manager.id, groupId: group.id },
  });

  const existingGoals = await prisma.weeklyGoal.findMany({
    where: {
      weekKey,
      OR: [
        { title: "Team Call Volume", ownerGroupId: group.id },
        { title: "Grace Follow-ups", assigneeId: rep.id },
      ],
    },
    select: { title: true },
  });

  const existingTitles = new Set(existingGoals.map((goal) => goal.title));

  if (!existingTitles.has("Team Call Volume")) {
    await prisma.weeklyGoal.create({
      data: {
        title: "Team Call Volume",
        weekKey,
        timeline: "WEEKLY",
        periodKey: weekKey,
        ownerType: GoalOwnerType.TEAM,
        metricType: GoalMetricType.CALLS,
        targetValue: 120,
        achievedValue: 40,
        ownerGroupId: group.id,
        createdById: manager.id,
      },
    });
  }

  if (!existingTitles.has("Grace Follow-ups")) {
    await prisma.weeklyGoal.create({
      data: {
        title: "Grace Follow-ups",
        weekKey,
        timeline: "WEEKLY",
        periodKey: weekKey,
        ownerType: GoalOwnerType.INDIVIDUAL,
        metricType: GoalMetricType.TEXTS,
        targetValue: 25,
        achievedValue: 8,
        assigneeId: rep.id,
        ownerGroupId: group.id,
        createdById: manager.id,
      },
    });
  }

  console.log("Seeded users");
  console.log({ adminId: admin.id, managerId: manager.id, repId: rep.id, groupId: group.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
