import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { ApplicationStatus } from "@/types/database";

const VALID_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "interview",
  "rejected",
  "offer",
  "archived",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await request.json();
  const status = body.status as ApplicationStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updates: {
    status: ApplicationStatus;
    applied_date?: string | null;
  } = { status };

  if (status === "applied") {
    updates.applied_date = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await auth.supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ application: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const { data, error } = await auth.supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
