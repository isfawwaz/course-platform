"use server";

import { revalidatePath } from "next/cache";

import { requireStaffOrg, resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export type ContentState = { error?: string; ok?: boolean };

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "course"
  );
}

/** Resolve org + assert the caller is staff; returns {orgId, userId} or an error string. */
async function staffContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgSlug: string,
): Promise<{ orgId: string; userId: string } | { error: string }> {
  const orgId = await resolveOrgIdBySlug(supabase, orgSlug);
  if (!orgId) return { error: "Studio not found." };
  const staff = await requireStaffOrg(supabase, orgId);
  if (!staff) return { error: "Staff only." };
  return { orgId, userId: staff.userId };
}

/** Verify a course belongs to the org (readable under the caller's session). */
async function courseInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

/** Verify a module belongs to the given course. */
async function moduleInCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
  courseId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .maybeSingle();
  return Boolean(data);
}

export async function createCourse(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const orgSlug = String(formData.get("org_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const ctx = await staffContext(supabase, orgSlug);
  if ("error" in ctx) return ctx;

  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 4)}`;
  const { error } = await supabase.from("courses").insert({
    org_id: ctx.orgId,
    title,
    slug,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin`);
  return { ok: true };
}

export async function createModule(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const orgSlug = String(formData.get("org_slug") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const ctx = await staffContext(supabase, orgSlug);
  if ("error" in ctx) return ctx;
  if (!(await courseInOrg(supabase, courseId, ctx.orgId))) {
    return { error: "Course not found." };
  }

  const { count } = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { error } = await supabase.from("modules").insert({
    org_id: ctx.orgId,
    course_id: courseId,
    title,
    position: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/courses/${courseId}`);
  return { ok: true };
}

export async function createLesson(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const orgSlug = String(formData.get("org_slug") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const required = formData.get("required") === "on";
  const videoId = String(formData.get("video_id") ?? "") || null;
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const ctx = await staffContext(supabase, orgSlug);
  if ("error" in ctx) return ctx;
  if (!(await courseInOrg(supabase, courseId, ctx.orgId))) {
    return { error: "Course not found." };
  }
  if (!(await moduleInCourse(supabase, moduleId, courseId))) {
    return { error: "Module not found in this course." };
  }

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  const { error } = await supabase.from("lessons").insert({
    org_id: ctx.orgId,
    course_id: courseId,
    module_id: moduleId,
    title,
    required,
    video_id: videoId,
    position: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/courses/${courseId}`);
  return { ok: true };
}
