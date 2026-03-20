import { AppReleasePlatform, FeedbackCategory, FeedbackStatus, GoalMetricType, GoalOwnerType, GoalStatus, GoalTimeline, ThreadType, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

const uuid = z.string().uuid();

export const userCreateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).optional(),
  regionName: z.string().optional().nullable(),
  zoneName: z.string().optional().nullable(),
  pastorGroupId: z.string().optional().nullable(),
  pastorGroupName: z.string().optional().nullable(),
  groupIds: z.array(uuid).optional(),
});

export const userUpdateSchema = userCreateSchema.partial();

export const groupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  managerId: uuid.optional().nullable(),
  memberIds: z.array(uuid).optional(),
});

export const contactSchema = z.object({
  repId: uuid,
  fullName: z.string().min(2),
  contactRole: z.string().optional().nullable(),
  zoneName: z.string().min(2),
  pastorGroup: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const activityReportSchema = z.object({
  repId: uuid,
  contactId: uuid.optional().nullable(),
  communicationSessionId: uuid.optional().nullable(),
  activityType: z.enum(["CALL", "MESSAGE", "INCOME"]),
  incomeAmount: z.number().int().nonnegative().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  contactRole: z.string().optional().nullable(),
  zoneName: z.string().min(2),
  pastorGroup: z.string().optional().nullable(),
  title: z.string().min(2),
  summary: z.string().min(2),
  actionsTaken: z.string().min(2),
  outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED"]).optional(),
  verified: z.boolean().optional(),
  activityDate: z.string().datetime(),
  followUpAt: z.string().datetime().optional().nullable(),
});

export const feedbackSchema = z.object({
  repId: uuid,
  contactId: uuid.optional().nullable(),
  reportId: uuid.optional().nullable(),
  title: z.string().min(2),
  description: z.string().min(2),
  category: z.nativeEnum(FeedbackCategory),
  status: z.nativeEnum(FeedbackStatus).optional(),
  resolutionNotes: z.string().optional().nullable(),
});

export const scriptSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(2),
  weekKey: z.string().min(7),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional(),
  groupIds: z.array(uuid).optional(),
});

export const goalSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  weekKey: z.string().min(7).optional().nullable(),
  timeline: z.nativeEnum(GoalTimeline),
  periodKey: z.string().min(4),
  ownerType: z.nativeEnum(GoalOwnerType),
  metricType: z.nativeEnum(GoalMetricType),
  targetValue: z.number().int().positive(),
  achievedValue: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(GoalStatus).optional(),
  assigneeId: uuid.optional().nullable(),
  ownerGroupId: uuid.optional().nullable(),
});

export const goalProgressSchema = z.object({
  achievedValue: z.number().int().nonnegative(),
  status: z.nativeEnum(GoalStatus).optional(),
});

export const threadSchema = z.object({
  title: z.string().optional().nullable(),
  type: z.nativeEnum(ThreadType),
  participantIds: z.array(uuid).min(1),
  groupId: uuid.optional().nullable(),
  initialMessage: z.string().min(1).optional().nullable(),
});

export const messageSchema = z.object({
  body: z.string().min(1),
});

export const communicationSessionCreateSchema = z.object({
  repId: uuid,
  contactId: uuid.optional().nullable(),
  channel: z.enum(["CALL", "MESSAGE"]),
  status: z.enum(["PENDING", "COMPLETED", "CANCELED"]).optional(),
  phoneNumber: z.string().optional().nullable(),
  messageBody: z.string().optional().nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  metadata: z.string().optional().nullable(),
});

export const communicationSessionUpdateSchema = communicationSessionCreateSchema
  .omit({ repId: true, channel: true, startedAt: true })
  .extend({
    contactId: uuid.optional().nullable(),
    status: z.enum(["PENDING", "COMPLETED", "CANCELED"]).optional(),
    endedAt: z.string().datetime().optional().nullable(),
    durationSeconds: z.number().int().nonnegative().optional().nullable(),
    messageBody: z.string().optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    metadata: z.string().optional().nullable(),
  })
  .partial();

export const broadcastSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  audienceType: z.enum(["ALL", "GROUP"]),
  targetGroupId: uuid.optional().nullable(),
});

export const appReleaseSchema = z.object({
  adminKey: z.string().min(1),
  version: z.string().min(1),
  platform: z.nativeEnum(AppReleasePlatform),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const appReleaseDeleteSchema = z.object({
  adminKey: z.string().min(1),
  id: uuid,
});

export const appReleaseUpdateSchema = z.object({
  id: uuid,
  adminKey: z.string().min(1),
  version: z.string().min(1),
  platform: z.nativeEnum(AppReleasePlatform),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
