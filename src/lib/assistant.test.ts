// Alma through Botpress's webchat API (a fake server here): the bot's answer once complete, the local answers otherwise.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ask } from "./assistant";

const at = (s: number) => new Date(Date.UTC(2026, 9, 29, 10, 0, s)).toISOString();
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Alma", () => {
  it("asks the bot and returns its answer, in plain text, once it has stopped changing", async () => {
    vi.useFakeTimers();
    let polls = 0;
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      const path = url.replace(/^https:\/\/webchat\.botpress\.cloud\/[^/]+/, "");
      calls.push(`${init.method} ${path} ${(init.headers as Record<string, string>)["x-user-key"] ?? "-"}`);
      if (path === "/users") return json({ user: { id: "me" }, key: "k" });
      if (path === "/conversations") return json({ conversation: { id: "c" } });
      if (path === "/messages") return json({ message: { createdAt: at(0) } });
      polls++;
      const mine = { userId: "me", createdAt: at(0), payload: { type: "text", text: "Par où commencer ?" } };
      const first = { userId: "bot", createdAt: at(1), payload: { type: "markdown", markdown: "## Bienvenue\n**Commencez** par vos cartes." } };
      const second = { userId: "bot", createdAt: at(2), payload: { type: "text", text: "Puis l'essentiel." } };
      return json({ messages: polls < 2 ? [mine] : polls < 3 ? [first, mine] : [second, first, mine], meta: {} });
    });
    const answer = ask("Par où commencer ?", "default");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await answer).toBe("Bienvenue\nCommencez par vos cartes.\n\nPuis l'essentiel.");
    expect(calls.slice(0, 3)).toEqual(["POST /users -", "POST /conversations k", "POST /messages k"]);
    expect(calls[3]).toBe("GET /conversations/c/messages k");
  });

  it("falls back on the local answers when the bot cannot be reached", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ask("C'est quoi un garant ?", "default")).toContain("Les garants sont les personnes");
  });
});
