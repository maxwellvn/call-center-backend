import { NextResponse } from "next/server";

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, meta: meta ?? null, error: null });
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, meta: meta ?? null, error: null }, { status: 201 });
}

export function failure(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      data: null,
      meta: null,
      error: { message, details: details ?? null },
    },
    { status },
  );
}
