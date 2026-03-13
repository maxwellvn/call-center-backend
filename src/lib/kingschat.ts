import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function pickValue(source: unknown, path: string[]) {
  let current = source;

  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function pickString(source: Record<string, unknown>, path: string[]) {
  const value = pickValue(source, path);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function splitFullName(fullName?: string) {
  const trimmed = fullName?.trim();

  if (!trimmed) {
    return { firstName: "KingsChat", lastName: "User" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);

  return {
    firstName: firstName || "KingsChat",
    lastName: rest.join(" ") || "User",
  };
}

export async function fetchKingsChatProfile(accessToken: string) {
  const profileUrls = [
    process.env.KINGSCHAT_PROFILE_URL,
    "https://connect.kingsch.at/api/profile",
    "https://connect.kingsch.at/api/v1/users/me",
  ].filter((value, index, array): value is string => !!value && array.indexOf(value) === index);

  for (const profileUrl of profileUrls) {
    try {
      const response = await fetch(profileUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (data && typeof data === "object") {
        return data as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("KingsChat profile lookup failed", error);
    }
  }

  throw new Error("Invalid KingsChat access token");
}

export async function findOrCreateKingsChatUser(accessToken: string) {
  const profile = await fetchKingsChatProfile(accessToken);

  const kingsChatUserId =
    pickString(profile, ["user_id"]) ??
    pickString(profile, ["userId"]) ??
    pickString(profile, ["profile", "user_id"]) ??
    pickString(profile, ["profile", "userId"]) ??
    pickString(profile, ["user", "user_id"]) ??
    pickString(profile, ["user", "userId"]) ??
    pickString(profile, ["profile", "user", "user_id"]) ??
    pickString(profile, ["profile", "user", "userId"]) ??
    pickString(profile, ["id"]) ??
    pickString(profile, ["profile", "id"]) ??
    pickString(profile, ["user", "id"]) ??
    pickString(profile, ["profile", "user", "id"]);

  if (!kingsChatUserId) {
    throw new Error("KingsChat profile does not include a user identifier");
  }

  const email =
    pickString(profile, ["email"]) ??
    pickString(profile, ["email", "address"]) ??
    pickString(profile, ["profile", "email"]) ??
    pickString(profile, ["profile", "email", "address"]) ??
    pickString(profile, ["user", "email"]) ??
    pickString(profile, ["user", "email", "address"]) ??
    pickString(profile, ["profile", "user", "email"]) ??
    pickString(profile, ["profile", "user", "email", "address"]) ??
    `kingschat_${kingsChatUserId.toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@kingschat.local`;

  const fullName =
    pickString(profile, ["full_name"]) ??
    pickString(profile, ["fullName"]) ??
    pickString(profile, ["name"]) ??
    pickString(profile, ["display_name"]) ??
    pickString(profile, ["profile", "full_name"]) ??
    pickString(profile, ["profile", "fullName"]) ??
    pickString(profile, ["profile", "name"]) ??
    pickString(profile, ["profile", "display_name"]) ??
    pickString(profile, ["user", "full_name"]) ??
    pickString(profile, ["user", "fullName"]) ??
    pickString(profile, ["user", "name"]) ??
    pickString(profile, ["profile", "user", "full_name"]) ??
    pickString(profile, ["profile", "user", "fullName"]) ??
    pickString(profile, ["profile", "user", "name"]) ??
    pickString(profile, ["profile", "user", "display_name"]) ??
    "KingsChat User";

  const { firstName, lastName } = splitFullName(fullName);
  const normalizedFullName = `${firstName} ${lastName}`.trim();
  const kingsChatUsername =
    pickString(profile, ["username"]) ??
    pickString(profile, ["profile", "username"]) ??
    pickString(profile, ["user", "username"]) ??
    pickString(profile, ["profile", "user", "username"]) ??
    pickString(profile, ["handle"]);

  const userByKingsChatId = await prisma.user.findUnique({
    where: { kingsChatUserId },
  });

  if (userByKingsChatId) {
    return prisma.user.update({
      where: { id: userByKingsChatId.id },
      data: {
        email: email.toLowerCase(),
        // Only update fullName if it was never set before (first login)
        // This prevents KingsChat from overwriting user's custom name
        ...(userByKingsChatId.fullName ? {} : { fullName: normalizedFullName }),
        kingsChatUsername: kingsChatUsername ?? userByKingsChatId.kingsChatUsername,
      },
      include: {
        groupMemberships: {
          include: { group: true },
        },
      },
    });
  }

  const userByEmail = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (userByEmail) {
    return prisma.user.update({
      where: { id: userByEmail.id },
      data: {
        // Only update fullName if it was never set before (first login)
        // This prevents KingsChat from overwriting user's custom name
        ...(userByEmail.fullName ? {} : { fullName: normalizedFullName }),
        kingsChatUserId,
        kingsChatUsername: kingsChatUsername ?? userByEmail.kingsChatUsername,
      },
      include: {
        groupMemberships: {
          include: { group: true },
        },
      },
    });
  }

  const existingKingsChatUsers = await prisma.user.count({
    where: {
      kingsChatUserId: {
        not: null,
      },
    },
  });

  const role = existingKingsChatUsers === 0 ? UserRole.ADMIN : UserRole.REP;

  return prisma.user.create({
    data: {
      fullName: normalizedFullName,
      email: email.toLowerCase(),
      kingsChatUserId,
      kingsChatUsername,
      role,
      title: role === UserRole.ADMIN ? "System Admin" : "Call Centre Representative",
    },
    include: {
      groupMemberships: {
        include: { group: true },
      },
    },
  });
}
