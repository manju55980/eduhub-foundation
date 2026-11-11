import { describe, expect, it } from "vitest";

import { filterAnswerCourses } from "../../supabase/functions/_shared/agent.ts";
import type { AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import {
  advisorTools,
  createAgentMemory,
  enrolmentTools,
  lowConfidenceEnrolmentMessage,
  parseSupervisorRoute,
  rememberTool,
  selectSpecialist,
  specialistSystemPrompt,
  specialistTools,
  specialistUserPrompt,
  tutorTools,
} from "../../supabase/functions/_shared/agent-team.ts";
import { handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";
import { authorizeTool } from "../../supabase/functions/_shared/guardrails.ts";
import { invalidAiMessage } from "../../supabase/functions/_shared/gemini.ts";

const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCourseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const publishableKey = `header.${btoa(JSON.stringify({ role: "anon" }))}.sig`;

function bearer() {
  return `Bearer header.${btoa(JSON.stringify({ sub: "student-1" }))}.sig`;
}

function modelReply(value: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function post(content: string) {
  return new Request("http://localhost/ai-agent", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify({ messages: [{ role: "user", content }] }),
  });
}

function reader(overrides: Partial<AgentReader> = {}): AgentReader & { calls: string[] } {
  const calls: string[] = [];
  const fail = async (name: string) => {
    calls.push(name);
    throw new Error(`${name} should not run`);
  };
  return {
    calls,
    userId: async () => {
      calls.push("user");
      return { ok: true, userId: "student-1" };
    },
    role: async () => {
      calls.push("role");
      return { ok: true, role: "student" };
    },
    matchKnowledge: () => fail("match"),
    course: () => fail("course"),
    enrolled: () => fail("enrolled"),
    lessons: () => fail("lessons"),
    enrol: () => fail("enrol"),
    grades: () => fail("grades"),
    catalogue: () => fail("catalogue"),
    publishedCount: () => fail("publishedCount"),
    latestPublished: () => fail("latestPublished"),
    ...overrides,
  };
}

function deps(agentReader: AgentReader, responses: unknown[]) {
  const pending = [...responses];
  return {
    supabaseUrl: "https://example.supabase.co",
    publishableKey,
    geminiKey: "test-key",
    authorization: bearer(),
    reader: agentReader,
    fetchImpl: async () => {
      const next = pending.shift();
      if (!next) throw new Error("unexpected model call");
      return modelReply(next);
    },
  };
}

describe("agent team", () => {
  it("rejects an unknown specialist and a confidence outside 0 to 1", () => {
    expect(parseSupervisorRoute({ agent: "supervisor", confidence: 0.9, task: "Route" }).ok).toBe(
      false,
    );
    expect(parseSupervisorRoute({ agent: "tutor", confidence: 1.2, task: "Explain" }).ok).toBe(
      false,
    );
    expect(parseSupervisorRoute({ agent: "tutor", confidence: 0.8, task: "   " }).ok).toBe(false);
    expect(parseSupervisorRoute({ agent: "advisor", confidence: 0, task: "Suggest" })).toEqual({
      ok: true,
      agent: "advisor",
      confidence: 0,
      task: "Suggest",
    });
  });

  it("gives each specialist its own tools", () => {
    expect(authorizeTool("enrol_in_course", tutorTools)).toBe(false);
    expect(authorizeTool("enrol_in_course", advisorTools)).toBe(false);
    expect(authorizeTool("enrol_in_course", enrolmentTools)).toBe(true);
    expect(authorizeTool("fetch_my_grades", specialistTools("tutor"))).toBe(false);
    expect(specialistSystemPrompt("tutor")).not.toContain("enrol_in_course");
    expect(specialistSystemPrompt("advisor")).not.toContain("enrol_in_course");
    expect(specialistSystemPrompt("enrolment")).toContain("enrol_in_course");
    expect(specialistSystemPrompt("tutor")).not.toContain("confidence");
  });

  it("shares course ids through request memory and still drops any other id", () => {
    const memory = createAgentMemory([
      { role: "user", content: "Email ada@example.com about algebra" },
    ]);
    rememberTool(memory, {
      name: "search_catalogue",
      payload: { matches: [{ title: "Algebra", courseId }] },
      courseIds: [courseId],
      enrolled: null,
    });
    const prompt = specialistUserPrompt(memory, "Explain ada@example.com");
    expect(prompt).toContain("[untrusted task]");
    expect(prompt).toContain(courseId);
    expect(prompt).not.toContain("ada@example.com");
    expect(prompt).toContain("[redacted]");
    expect(
      filterAnswerCourses(
        [
          { id: courseId, title: "Algebra" },
          { id: otherCourseId, title: "Other" },
        ],
        new Set(memory.courseIds),
      ),
    ).toEqual([{ id: courseId, title: "Algebra" }]);
  });

  it("refuses a low-confidence enrolment before any tool runs", async () => {
    const agentReader = reader();
    const response = await handleAgent(
      post("Please enrol me in Algebra"),
      deps(agentReader, [
        { agent: "enrolment", confidence: 0.69, task: "Enrol Algebra." },
        { type: "tool", name: "enrol_in_course", arguments: { courseId } },
      ]),
    );
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      text: lowConfidenceEnrolmentMessage,
      courses: [],
      enrolled: null,
    });
    expect(body).not.toHaveProperty("confidence");
    expect(agentReader.calls).toEqual(["user", "role"]);
  });

  it("does not let the tutor or advisor enrol, and a recommendation does not insert", async () => {
    const tutorReader = reader();
    const tutor = await handleAgent(
      post("Explain algebra"),
      deps(tutorReader, [
        { agent: "tutor", confidence: 0.9, task: "Explain algebra." },
        { type: "tool", name: "enrol_in_course", arguments: { courseId } },
      ]),
    );
    expect(await tutor.json()).toMatchObject({ ok: false, message: invalidAiMessage });
    expect(tutorReader.calls).toEqual(["user", "role"]);

    const advisorReader = reader();
    const advisor = await handleAgent(
      post("What should I take next?"),
      deps(advisorReader, [
        { agent: "advisor", confidence: 0.92, task: "Recommend a course." },
        { type: "tool", name: "enrol_in_course", arguments: { courseId } },
      ]),
    );
    expect(await advisor.json()).toMatchObject({ ok: false, message: invalidAiMessage });
    expect(advisorReader.calls).not.toContain("enrol");
  });

  it("keeps the enrol phrase check and follows that phrase onto the enrolment specialist", async () => {
    expect(
      selectSpecialist({ agent: "tutor", confidence: 0.95 }, [
        { role: "user", content: "Please enrol me" },
      ]),
    ).toEqual({ kind: "run", agent: "enrolment" });

    const blocked = reader();
    const refused = await handleAgent(
      post("Tell me about algebra"),
      deps(blocked, [
        { agent: "enrolment", confidence: 0.9, task: "Enrol anyway." },
        { type: "tool", name: "enrol_in_course", arguments: { courseId } },
        { type: "answer", text: "I have not enrolled you.", courses: [] },
      ]),
    );
    expect(await refused.json()).toMatchObject({ ok: true, text: "I have not enrolled you." });
    expect(blocked.calls).not.toContain("enrol");

    const enrolled = reader({
      enrol: async () => {
        enrolled.calls.push("enrol");
        return { ok: true, title: "Algebra", courseId, already: false };
      },
    });
    const accepted = await handleAgent(
      post("Please enrol me in Algebra"),
      deps(enrolled, [
        { agent: "tutor", confidence: 0.95, task: "Explain instead." },
        { type: "tool", name: "enrol_in_course", arguments: { courseId } },
        {
          type: "answer",
          text: "You are enrolled.",
          courses: [{ id: courseId, title: "Algebra" }],
        },
      ]),
    );
    const body = await accepted.json();
    expect(body).toMatchObject({
      ok: true,
      text: "You are enrolled.",
      courses: [{ id: courseId, title: "Algebra" }],
      enrolled: { id: courseId, title: "Algebra" },
    });
    expect(body).not.toHaveProperty("confidence");
    expect(enrolled.calls).toContain("enrol");
  });

  it("drops a course id the tutor tools did not return", async () => {
    const agentReader = reader({
      course: async () => ({
        ok: true,
        course: {
          id: courseId,
          title: "Algebra",
          description: "Numbers",
          level: "beginner",
          status: "published",
          categoryId: null,
          createdAt: "2026-10-01",
        },
      }),
      enrolled: async () => ({ ok: true, enrolled: true }),
      lessons: async () => ({
        ok: true,
        lessons: [{ title: "Lines", content: "A straight path." }],
      }),
    });
    const response = await handleAgent(
      post("Explain this lesson"),
      deps(agentReader, [
        { agent: "tutor", confidence: 0.88, task: "Explain the lesson." },
        { type: "tool", name: "describe_course", arguments: { courseId } },
        {
          type: "answer",
          text: "Lines are a straight path.",
          courses: [
            { id: courseId, title: "Algebra" },
            { id: otherCourseId, title: "Not returned" },
          ],
        },
      ]),
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      text: "Lines are a straight path.",
      courses: [{ id: courseId, title: "Algebra" }],
      enrolled: null,
    });
  });
});
