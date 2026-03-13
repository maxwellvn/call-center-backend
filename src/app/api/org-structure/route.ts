import { ok, failure } from "@/lib/response";

type GroupRecord = {
  name: string;
  id: string;
};

type ZoneRecord = {
  name: string;
  groups: GroupRecord[];
};

type RegionRecord = {
  name: string;
  zones: ZoneRecord[];
  regionGroups: GroupRecord[];
  updatedAt: string | null;
};

function isMetaKey(key: string) {
  return key === "name" || key === "groups" || key === "_updated_at" || key === "updated_at";
}

function toGroupArray(input: unknown): GroupRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is { name?: unknown; id?: unknown } => !!item && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "Unknown group",
      id: typeof item.id === "string" ? item.id : `group_${Math.random().toString(36).slice(2, 10)}`,
    }));
}

function normalizeStructure(payload: Record<string, unknown>): RegionRecord[] {
  return Object.entries(payload).map(([regionName, regionValue]) => {
    const regionObject = regionValue && typeof regionValue === "object" ? (regionValue as Record<string, unknown>) : {};
    const zones = Object.entries(regionObject)
      .filter(([key, value]) => !isMetaKey(key) && value && typeof value === "object")
      .map(([zoneName, zoneValue]) => {
        const zoneObject = zoneValue as Record<string, unknown>;

        return {
          name: zoneObject.name && typeof zoneObject.name === "string" ? zoneObject.name : zoneName,
          groups: toGroupArray(zoneObject.groups),
        };
      });

    return {
      name: regionName,
      zones,
      regionGroups: toGroupArray(regionObject.groups),
      updatedAt:
        typeof regionObject._updated_at === "string"
          ? regionObject._updated_at
          : typeof regionObject.updated_at === "string"
            ? regionObject.updated_at
            : null,
    };
  });
}

export async function GET() {
  try {
    const response = await fetch("https://order.rorglobalpartnershipdepartment.org/zones.json", {
      cache: "no-store",
    });

    if (!response.ok) {
      return failure("Failed to fetch organization structure", response.status);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return ok(normalizeStructure(payload));
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch organization structure", 500);
  }
}
