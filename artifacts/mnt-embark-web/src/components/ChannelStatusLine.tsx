import { useGetNotificationChannels } from "@workspace/api-client-react";
import { cn } from "@workspace/mnt-embark/lib/utils";

/**
 * Whether the site can actually reach anybody, on one line.
 *
 * The distinction it exists to make is between "configured" and "working".
 * Credentials that look complete and are silently rejected are the failure this
 * catches, and the only place that was previously visible was a boot log — so
 * the honest answer to "is WhatsApp live?" required SSH access.
 *
 * A channel with no credentials at all is not an error and is not styled as
 * one: a site that has deliberately not set up WhatsApp is working correctly.
 */
export function ChannelStatusLine() {
  const { data } = useGetNotificationChannels();

  if (!data) return null;

  return (
    <div
      data-testid="channel-status"
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
    >
      {data.channels.map((c) => {
        /*
         * Three states, not two. A channel nobody set up is working as
         * intended; one whose credentials were rejected is broken and looks
         * identical unless the two are told apart deliberately.
         */
        const off = !c.configured;
        return (
          <span
            key={c.key}
            data-testid={`channel-${c.key}`}
            /*
             * The provider's own words on hover. "Not configured" is the whole
             * story for an unused channel; for a rejected one, "Invalid login:
             * 535 authentication failed" is the difference between fixing it in
             * a minute and hunting for an hour.
             */
            title={c.detail ?? c.identity ?? undefined}
            className="flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground"
          >
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                c.ready
                  ? "bg-primary"
                  : off
                    ? "bg-muted-foreground/40"
                    : "bg-destructive",
              )}
            />
            <span className="text-foreground/80">{c.label}</span>
            <span>
              {c.ready ? "ready" : off ? "not configured" : "not working"}
            </span>
          </span>
        );
      })}

      {/*
        Only shown when there is something to say. A permanent "0 waiting" is
        noise that trains people to stop reading the line.
      */}
      {data.queued > 0 && (
        <span
          data-testid="channel-queued"
          className="font-sans text-[11px] text-muted-foreground"
        >
          {data.queued} waiting
        </span>
      )}
      {data.failed > 0 && (
        <span
          data-testid="channel-failed"
          className="font-sans text-[11px] text-destructive"
        >
          {data.failed} failed
        </span>
      )}
    </div>
  );
}
