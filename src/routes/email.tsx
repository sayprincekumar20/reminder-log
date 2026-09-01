import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: "Email Inbox | Rare Global Food Collections" },
      {
        name: "description",
        content:
          "Real Gmail threads for every overdue client — subject, sender, timestamps and full message body in one collections inbox.",
      },
      { property: "og:title", content: "Email Inbox | Rare Global Food Collections" },
      {
        property: "og:description",
        content: "Live Gmail conversation history for overdue collections follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailTab,
});

interface ThreadListItem {
  client_id: string;
  client_name: string;
  thread_id: string;
  notified_ar: boolean;
  promise_recorded: boolean;
  message_count: number;
  lastMessagePreview: string;
  lastDirection: string;
  lastMessageAt: string;
}

interface ThreadAttachment {
  filename: string;
  mimeType: string;
  size: number;
}

interface ThreadMessage {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachments: ThreadAttachment[];
  direction: "inbound" | "outbound";
}

interface ThreadDetail {
  threadId: string;
  subject: string;
  messages: ThreadMessage[];
}

function formatListDate(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function formatMsgDate(dateHeader: string): string {
  if (!dateHeader) return "";
  try {
    return new Date(dateHeader).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateHeader;
  }
}

function isHtmlBody(body: string): boolean {
  return /<html[\s>]/i.test(body) || /<!DOCTYPE html/i.test(body);
}

function useThreadsList() {
  return useQuery({
    queryKey: ["gmail-threads-list"],
    queryFn: async () => {
      const r = await fetch("/api/gmail-threads-list");
      if (!r.ok) throw new Error("Email threads fetch failed");
      const d = await r.json();
      return (d.threads ?? []) as ThreadListItem[];
    },
    refetchInterval: 30000,
  });
}

function useThreadDetail(threadId: string | null) {
  return useQuery({
    queryKey: ["gmail-thread-detail", threadId],
    queryFn: async () => {
      const r = await fetch(`/api/gmail-thread-detail?threadId=${encodeURIComponent(threadId!)}`);
      if (!r.ok) throw new Error("Thread detail fetch failed");
      return (await r.json()) as ThreadDetail;
    },
    enabled: !!threadId,
  });
}

function MessageBody({ body }: { body: string }) {
  if (isHtmlBody(body)) {
    return (
      <iframe
        title="email-body"
        srcDoc={body}
        sandbox=""
        className="w-full border-0"
        style={{ minHeight: "180px" }}
        onLoad={(e) => {
          const el = e.currentTarget;
          try {
            const h = el.contentWindow?.document.body.scrollHeight;
            if (h) el.style.height = h + 20 + "px";
          } catch {
            /* cross-origin guard, ignore */
          }
        }}
      />
    );
  }
  return <div className="whitespace-pre-wrap text-sm leading-relaxed">{body}</div>;
}

function EmailTab() {
  const { data: threads, isLoading, error } = useThreadsList();
  const [search, setSearch] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const filteredThreads = useMemo(() => {
    const all = threads ?? [];
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((t) => [t.client_id, t.client_name].join(" ").toLowerCase().includes(q));
  }, [threads, search]);

  const activeItem =
    filteredThreads.find((t) => t.thread_id === activeThreadId) ?? filteredThreads[0];

  const { data: detail, isLoading: detailLoading } = useThreadDetail(activeItem?.thread_id || null);

  return (
    <AppShell title="Email" subtitle="Real Gmail threads for overdue collections">
      <div
        className="grid grid-cols-1 overflow-hidden rounded-xl bg-card shadow-sm md:grid-cols-[35%_65%]"
        style={{ height: "calc(100vh - 12rem)" }}
      >
        {/* Left panel — thread list */}
        <div className="flex min-h-0 flex-col border-r border-border bg-secondary">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="text-lg font-black text-primary">Email</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client name…"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {error && (
              <div className="p-4 text-sm text-destructive">Failed to load email threads.</div>
            )}
            {!isLoading && filteredThreads.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <div className="mb-2 text-2xl">📧</div>
                <div className="font-medium">No email conversations yet</div>
              </div>
            )}
            {filteredThreads.map((t) => {
              const isActive = activeItem?.thread_id === t.thread_id;
              return (
                <button
                  key={t.thread_id || t.client_id}
                  onClick={() => setActiveThreadId(t.thread_id)}
                  className={`w-full border-b border-border px-4 py-3 text-left hover:bg-card ${
                    isActive ? "border-l-[3px] border-l-primary bg-card" : "border-l-[3px] border-l-transparent"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <div className="flex-1 truncate text-sm font-bold text-foreground">
                      {t.client_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatListDate(t.lastMessageAt)}
                    </div>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.lastMessagePreview}
                  </div>
                  <div className="mt-1 flex gap-1">
                    {t.promise_recorded && (
                      <span className="rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Promise made
                      </span>
                    )}
                    {t.notified_ar && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Needs AR
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — real Gmail thread */}
        <div className="flex min-h-0 flex-col overflow-y-auto bg-muted">
          {!activeItem ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a conversation to view
            </div>
          ) : detailLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Loading thread from Gmail…</div>
          ) : !detail || !detail.messages?.length ? (
            <div className="p-8 text-sm text-destructive">Could not load this thread from Gmail.</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4">
                <div className="text-lg font-bold text-foreground">
                  {detail.subject || "(no subject)"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {detail.messages.length} message{detail.messages.length > 1 ? "s" : ""} ·{" "}
                  {activeItem.client_name}
                </div>
              </div>
              <div className="space-y-4 p-6">
                {detail.messages.map((m) => (
                  <div
                    key={m.messageId}
                    className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm border-l-4 ${
                      m.direction === "outbound" ? "border-l-primary" : "border-l-success"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-muted px-4 py-2">
                      <div className="text-sm">
                        <span className="font-semibold">{m.from}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="text-muted-foreground">{m.to}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatMsgDate(m.date)}</div>
                    </div>
                    <div className="p-4">
                      <MessageBody body={m.body} />
                    </div>
                    {m.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-4 pb-3">
                        {m.attachments.map((a, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs"
                          >
                            📎 {a.filename}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
