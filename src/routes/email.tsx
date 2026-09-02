import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel, StatCard, ChannelBadge } from "@/components/collections/Bits";
import { clientsQuery, peso, shortDate } from "@/lib/collections";

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
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(clientsQuery);
  },
  component: EmailInbox,
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
        style={{ minHeight: "140px" }}
        onLoad={(e) => {
          const el = e.currentTarget;
          try {
            const h = el.contentWindow?.document.body.scrollHeight;
            if (h) el.style.height = h + 20 + "px";
          } catch {
            /* ignore */
          }
        }}
      />
    );
  }
  return <p className="whitespace-pre-wrap">{body}</p>;
}

function FlagTag({ kind }: { kind: "promise" | "ar" }) {
  const promise = kind === "promise";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        color: promise ? "var(--whatsapp)" : "var(--primary)",
        backgroundColor: `color-mix(in oklab, ${promise ? "var(--whatsapp)" : "var(--primary)"} 14%, transparent)`,
      }}
    >
      {promise ? "Promise to pay" : "AR notified"}
    </span>
  );
}

function EmailInbox() {
  const { data: clients } = useSuspenseQuery(clientsQuery);
  const { data: threadsData, isLoading, error } = useThreadsList();
  const threads = threadsData ?? [];
  const [active, setActive] = useState<string | null>(null);
  const activeItem = threads.find((t) => t.thread_id === active) ?? threads[0];
  const { data: detail, isLoading: detailLoading } = useThreadDetail(
    activeItem?.thread_id ?? null,
  );
  const activeClient = clients.find((c) => c.id === activeItem?.client_id);

  const messages = detail?.messages ?? [];

  return (
    <AppShell title="Email Inbox" subtitle="Delivered through Gmail · relayed by n8n">
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Conversations" value={String(threads.length)} tone="primary" />
        <StatCard
          label="Outbound"
          value={String(threads.filter((t) => t.lastDirection === "outbound").length)}
        />
        <StatCard
          label="Replies received"
          value={String(threads.filter((t) => t.lastDirection === "inbound").length)}
        />
        <StatCard
          label="Promises to pay"
          value={String(threads.filter((t) => t.promise_recorded).length)}
          hint="Client committed to a payment date"
        />
        <StatCard
          label="AR notified"
          value={String(threads.filter((t) => t.notified_ar).length)}
          hint="Overdue reminder escalated to AR"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <Panel title="Threads" description={`${threads.length} clients`}>
          <ul className="divide-y divide-border">
            {threads.map((t) => (
              <li key={t.thread_id || t.client_id}>
                <button
                  onClick={() => setActive(t.thread_id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    t.thread_id === activeItem?.thread_id ? "bg-secondary" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t.client_name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {shortDate(t.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {t.lastMessagePreview || "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.promise_recorded ? <FlagTag kind="promise" /> : null}
                    {t.notified_ar ? <FlagTag kind="ar" /> : null}
                  </div>
                </button>
              </li>
            ))}
            {isLoading ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">Loading Gmail threads…</li>
            ) : null}
            {error ? (
              <li className="px-4 py-6 text-sm text-destructive">
                Could not load Gmail threads from n8n.
              </li>
            ) : null}
            {!isLoading && !error && threads.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                No Email activity logged yet.
              </li>
            ) : null}
          </ul>
        </Panel>

        <Panel
          title={activeItem?.client_name ?? "No conversation selected"}
          description={
            activeClient
              ? `${peso(activeClient.collection_amount)} outstanding · due ${shortDate(activeClient.due_date)}`
              : (detail?.subject ?? undefined)
          }
          action={
            activeClient ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId: activeClient.id }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View client
              </Link>
            ) : null
          }
        >
          <ol className="space-y-4 p-4">
            {messages.map((m) => {
              const outbound = m.direction === "outbound";
              return (
                <li
                  key={m.messageId}
                  className={`flex flex-col gap-1 ${outbound ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <ChannelBadge channel="email" />
                    {outbound ? m.to : m.from} · {shortDate(m.date)}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-xl border px-3.5 py-2.5 text-sm ${
                      outbound
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-muted"
                    }`}
                  >
                    {m.subject ? (
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-80">
                        {m.subject}
                      </p>
                    ) : null}
                    <MessageBody body={m.body} />
                    {m.attachments?.length ? (
                      <p className="mt-2 border-t border-current/20 pt-2 text-xs opacity-90">
                        {m.attachments.map((a) => a.filename).join(", ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {detailLoading ? (
              <li className="text-sm text-muted-foreground">Loading thread from Gmail…</li>
            ) : null}
            {!detailLoading && messages.length === 0 ? (
              <li className="text-sm text-muted-foreground">Nothing to show.</li>
            ) : null}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
}
