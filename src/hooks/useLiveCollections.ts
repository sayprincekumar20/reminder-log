import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLE_KEYS: Record<string, string> = {
  messages: "messages",
  reminder_queue: "reminder_queue",
  channel_counters: "channel_counters",
  daily_run_logs: "daily_run_logs",
  clients: "clients",
};

/**
 * Subscribes once to realtime changes on the collections tables and
 * invalidates the matching React Query caches so the dashboard updates
 * the instant n8n writes a row.
 */
export function useLiveCollections() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("collections-live");

    for (const table of Object.keys(TABLE_KEYS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: [TABLE_KEYS[table]] });
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
