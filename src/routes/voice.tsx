import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel, StatCard, StatusPill } from "@/components/collections/Bits";
import { clientsQuery, messagesQuery, peso, shortDate } from "@/lib/collections";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "Voice Call Logs | Rare Global Food Collections" },
      {
        name: "description",
        content:
          "Every AI voice call to overdue clients — direction, duration, status, transcript, and recording, sourced live from Vapi.",
      },
      { property: "og:title", content: "Voice Call Logs | Rare Global Food Collections" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(clientsQuery),
      context.queryClient.ensureQueryData(messagesQuery),
    ]);
  },
  component: VoiceLogs,
});

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoiceLogs() {
  const { data: clients } = useSuspenseQuery(clientsQuery);
  const { data: messages } = useSuspenseQuery(messagesQuery);

  const voiceCalls = messages
    .filter((m) => m.channel === "voice")
    .slice()
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const [active, setActive] = useState<string | null>(null);
  const activeCall = voiceCalls.find((c) => c.id === active) ?? voiceCalls[0];
  const activeClient = clients.find((c) => c.id === activeCall?.client_id);

  const completed = voiceCalls.filter((c) => c.status === "completed").length;
  const noAnswer = voiceCalls.filter((c) => c.status === "no_answer").length;
  const totalDuration = voiceCalls.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0);

  return (
    <AppShell title="Voice Call Logs" subtitle="Delivered through Vapi · relayed by n8n">
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total calls" value={String(voiceCalls.length)} tone="primary" />
        <StatCard label="Completed" value={String(completed)} />
        <StatCard label="No answer / busy" value={String(noAnswer)} />
        <StatCard
          label="Total talk time"
          value={formatDuration(totalDuration)}
          hint="Across all calls"
        />
        <StatCard
          label="Promises to pay"
          value={String(voiceCalls.filter((c) => c.promise_recorded).length)}
          hint="Confirmed on a call"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        <Panel title="Calls" description={`${voiceCalls.length} logged`}>
          <ul className="divide-y divide-border">
            {voiceCalls.map((c) => {
              const client = clients.find((x) => x.id === c.client_id);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActive(c.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      c.id === activeCall?.id ? "bg-secondary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {client?.client_name ?? "Unknown"}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {shortDate(c.occurred_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {client?.phone ?? "—"} · {c.direction === "inbound" ? "Inbound" : "Outbound"} ·{" "}
                      {formatDuration(c.duration_seconds)}
                    </p>
                    <div className="mt-1">
                      <StatusPill status={c.status} />
                    </div>
                  </button>
                </li>
              );
            })}
            {voiceCalls.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                No voice calls logged yet.
              </li>
            ) : null}
          </ul>
        </Panel>

        <Panel
          title={activeClient?.client_name ?? "No call selected"}
          description={
            activeClient
              ? `${activeClient.phone ?? "—"} · ${peso(activeClient.collection_amount)} outstanding`
              : undefined
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
          {activeCall ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <StatusPill status={activeCall.status} />
                <span>{activeCall.direction === "inbound" ? "Inbound call" : "Outbound call"}</span>
                <span>{formatDuration(activeCall.duration_seconds)} duration</span>
                <span>{shortDate(activeCall.occurred_at)}</span>
                {activeCall.agent_name ? <span>Agent: {activeCall.agent_name}</span> : null}
              </div>

              {(activeCall as unknown as { recording_url?: string }).recording_url ? (
                <audio
                  controls
                  src={(activeCall as unknown as { recording_url?: string }).recording_url}
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-muted-foreground">No recording available for this call.</p>
              )}

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Transcript
                </h3>
                {activeCall.transcript ? (
                  <div className="rounded-xl border border-border bg-muted p-4 text-sm whitespace-pre-wrap">
                    {activeCall.transcript}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No transcript available — this call likely did not connect.
                  </p>
                )}
              </div>

              {activeCall.body && activeCall.body !== activeCall.transcript ? (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Summary
                  </h3>
                  <p className="text-sm text-muted-foreground">{activeCall.body}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Nothing to show.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
