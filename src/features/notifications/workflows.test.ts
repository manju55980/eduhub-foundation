import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { handleAssignmentReminderRequest } from "./assignment-reminders-handler";
import {
  planAssignmentReminders,
  reminderCandidates,
  reminderTitle,
  reminderWindowMs,
  runAssignmentReminders,
  type AssignmentRow,
  type ReminderStore,
} from "./assignment-reminders";
import { supabaseReminderStore } from "./assignment-reminders.server";
import { shownCertificate } from "./notifications-api";

const now = new Date("2026-10-18T12:00:00.000Z");
const dueSoon = "2026-10-20T12:00:00.000Z";
const dueLater = new Date(now.getTime() + reminderWindowMs + 60_000).toISOString();
const dueEdge = new Date(now.getTime() + reminderWindowMs).toISOString();

const assignment: AssignmentRow = {
  id: "assignment-1",
  title: "Essay",
  dueDate: dueSoon,
  courseId: "course-1",
  courseTitle: "Algebra",
};

describe("assignment reminders", () => {
  it("reminds only enrolled students who have not submitted and are inside 72 hours", async () => {
    const planned = planAssignmentReminders(
      reminderCandidates({
        assignments: [
          assignment,
          { ...assignment, id: "assignment-open", dueDate: null },
          { ...assignment, id: "assignment-past", dueDate: "2026-10-18T12:00:00.000Z" },
          { ...assignment, id: "assignment-later", dueDate: dueLater },
          { ...assignment, id: "assignment-edge", dueDate: dueEdge, title: "Edge" },
        ],
        enrollments: [
          { id: "enrollment-1", studentId: "student-1", courseId: "course-1" },
          { id: "enrollment-2", studentId: "student-2", courseId: "course-1" },
        ],
        submissions: [
          { assignmentId: "assignment-1", studentId: "student-2" },
          { assignmentId: "assignment-edge", studentId: "student-2" },
        ],
      }),
      now,
      new Set([`assignment_due:assignment-edge:student-1:${dueEdge}`]),
    );

    expect(planned).toEqual([
      {
        recipient_id: "student-1",
        kind: "assignment_due",
        course_id: "course-1",
        enrollment_id: "enrollment-1",
        assignment_id: "assignment-1",
        title: reminderTitle,
        body: "Essay is due soon in Algebra.",
        dedupe_key: `assignment_due:assignment-1:student-1:${dueSoon}`,
      },
    ]);
    expect(planned[0]?.body).not.toMatch(/email|phone|@/);

    const store = memoryStore(planned.map((row) => row.dedupe_key));
    const second = await runAssignmentReminders(store, now);
    expect(second.inserted).toBe(0);
    expect(store.inserted).toEqual([]);
  });

  it("inserts a new row when the due date changes and ignores a duplicate key", async () => {
    const changed = "2026-10-19T12:00:00.000Z";
    const store = memoryStore([`assignment_due:assignment-1:student-1:${dueSoon}`]);
    store.assignments = [{ ...assignment, dueDate: changed }];
    store.enrollments = [{ id: "enrollment-1", studentId: "student-1", courseId: "course-1" }];

    const result = await runAssignmentReminders(store, now);

    expect(result.inserted).toBe(1);
    expect(store.inserted[0]?.dedupe_key).toBe(`assignment_due:assignment-1:student-1:${changed}`);
  });

  it("upserts reminders on the dedupe key and does not read profiles", async () => {
    const client = recordingClient({
      assignments: Array.from({ length: 101 }, (_, index) => ({
        id: `assignment-${index}`,
        title: "Quiz",
        due_date: dueSoon,
        course_id: `course-${index}`,
      })),
      courses: [{ id: "course-0", title: "Algebra" }],
      enrollments: [{ id: "enrollment-1", student_id: "student-1", course_id: "course-0" }],
      submissions: [],
      notifications: [],
    });

    const result = await runAssignmentReminders(supabaseReminderStore(client), now);

    expect(result.inserted).toBe(1);
    expect(client.tables).not.toContain("profiles");
    expect(client.inCalls.filter((call) => call.table === "courses")).toHaveLength(2);
    const upsert = client.upserts[0];
    expect(upsert?.options).toEqual({ onConflict: "dedupe_key", ignoreDuplicates: true });
    expect(upsert?.rows[0]).toMatchObject({
      kind: "assignment_due",
      recipient_id: "student-1",
      assignment_id: "assignment-0",
    });
    expect(upsert?.rows.every((row) => row.kind === "assignment_due")).toBe(true);
  });
});

describe("assignment reminder request", () => {
  it("accepts only the cron bearer on POST and does not run the job otherwise", async () => {
    const previous = process.env.LOVABLE_CRON_SECRET;
    const previousOld = process.env.LOVABLE_CRON_SECRET_PREVIOUS;
    process.env.LOVABLE_CRON_SECRET = "cron-test-secret";
    delete process.env.LOVABLE_CRON_SECRET_PREVIOUS;
    let runs = 0;
    const run = async () => {
      runs += 1;
      return { inserted: 2 };
    };

    try {
      const missing = await handleAssignmentReminderRequest(reminderRequest("POST"), run);
      expect(missing.status).toBe(401);
      const wrong = await handleAssignmentReminderRequest(
        reminderRequest("POST", "Bearer wrong-secret"),
        run,
      );
      expect(wrong.status).toBe(401);
      const get = await handleAssignmentReminderRequest(
        reminderRequest("GET", "Bearer cron-test-secret"),
        run,
      );
      expect(get.status).toBe(405);
      const ok = await handleAssignmentReminderRequest(
        reminderRequest("POST", "Bearer cron-test-secret"),
        run,
      );
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ok: true, inserted: 2 });
      expect(runs).toBe(1);

      delete process.env.LOVABLE_CRON_SECRET;
      const unconfigured = await handleAssignmentReminderRequest(reminderRequest("POST"), run);
      expect(unconfigured.status).toBe(500);
      expect(runs).toBe(1);
    } finally {
      restoreEnv("LOVABLE_CRON_SECRET", previous);
      restoreEnv("LOVABLE_CRON_SECRET_PREVIOUS", previousOld);
    }
  });

  it("keeps the job off the browser client and the paused RAG and classifier paths", () => {
    const root = resolve(process.cwd());
    const server = readFileSync(
      resolve(root, "src/features/notifications/assignment-reminders.server.ts"),
      "utf8",
    );
    const entry = readFileSync(resolve(root, "src/server.ts"), "utf8");
    expect(server).toContain("@/integrations/supabase/client.server");
    expect(server).not.toContain('integrations/supabase/client"');
    expect(server).not.toContain("seed-rag");
    expect(server).not.toContain("level-accuracy");
    expect(server).not.toContain("rag_chunks");
    expect(entry).toContain('pathname === "/api/assignment-reminders"');
    expect(entry).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("completion certificate visibility", () => {
  it("shows a certificate only while the enrollment is completed", () => {
    const certificates = [
      {
        enrollmentId: "enrollment-1",
        courseId: "course-1",
        issuedAt: "2026-10-18T00:00:00.000Z",
      },
    ];
    expect(shownCertificate("active", "enrollment-1", certificates)).toBeNull();
    expect(shownCertificate("completed", "enrollment-1", certificates)?.issuedAt).toBe(
      "2026-10-18T00:00:00.000Z",
    );
    expect(shownCertificate("completed", "enrollment-2", certificates)).toBeNull();
  });
});

function memoryStore(existing: string[]): ReminderStore & {
  assignments: AssignmentRow[];
  enrollments: { id: string; studentId: string; courseId: string }[];
  inserted: { dedupe_key: string }[];
} {
  const store = {
    assignments: [] as AssignmentRow[],
    enrollments: [] as { id: string; studentId: string; courseId: string }[],
    inserted: [] as { dedupe_key: string }[],
    loadAssignments: async () => store.assignments,
    loadEnrollments: async () => store.enrollments,
    loadSubmissions: async () => [],
    loadExistingKeys: async () => existing,
    insertReminders: async (rows: { dedupe_key: string }[]) => {
      store.inserted.push(...rows);
    },
  };
  return store;
}

function recordingClient(pages: Record<string, Record<string, unknown>[]>) {
  const tables: string[] = [];
  const inCalls: Array<{ table: string; values: string[] }> = [];
  const upserts: Array<{
    rows: Array<{ kind: string; recipient_id: string; assignment_id: string; dedupe_key: string }>;
    options: unknown;
  }> = [];

  function filter(table: string) {
    const api = {
      eq() {
        return api;
      },
      gt() {
        return api;
      },
      lte() {
        return api;
      },
      in(_column: string, values: string[]) {
        inCalls.push({ table, values });
        return api;
      },
      order() {
        return api;
      },
      range(from: number, to: number) {
        return Promise.resolve({
          data: (pages[table] ?? []).slice(from, to + 1),
          error: null,
        });
      },
    };
    return api;
  }

  return {
    tables,
    inCalls,
    upserts,
    from(table: string) {
      tables.push(table);
      return {
        select() {
          return filter(table);
        },
        upsert(
          rows: Array<{
            kind: string;
            recipient_id: string;
            assignment_id: string;
            dedupe_key: string;
          }>,
          options: unknown,
        ) {
          upserts.push({ rows, options });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}

function reminderRequest(method: string, authorization?: string) {
  return new Request("http://localhost/api/assignment-reminders", {
    method,
    headers: authorization ? { authorization } : undefined,
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
