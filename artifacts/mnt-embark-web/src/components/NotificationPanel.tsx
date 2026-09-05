import { useQueryClient } from "@tanstack/react-query";
import {
  useListEnquiryNotifications,
  useResendNotification,
  getListEnquiryNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * What was sent to whom for one enquiry, and whether it arrived.
 *
 * Worth a panel of its own because the honest answer is sometimes "not yet" or
 * "it failed". Sending happens in the background, so without this the admin has
 * no way to tell a delivered confirmation from one still queued behind a
 * rejected password — and would find out only when a client says they never
 * heard back.
 */

const LABELS: Record<string, string> = {
  enquiry_client_confirmation: "Confirmation to client",
  enquiry_admin_alert: "Alert to office",
  test_email: "Test email",
};

function StatusText({ status }: { status: Notification["status"] }) {
  const tone =
    status === "sent"
      ? "text-primary"
      : status === "failed"
        ? "text-destructive"
        : "text-muted-foreground";
  const label =
    status === "sent" ? "Sent" : status === "failed" ? "Failed" : "Queued";
  return (
    <span
      className={`font-sans text-[10px] uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
}

export function NotificationPanel({ enquiryId }: { enquiryId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListEnquiryNotifications(enquiryId);
  const resend = useResendNotification();

  const handleResend = (n: Notification) => {
    resend.mutate(
      { id: n.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListEnquiryNotificationsQueryKey(enquiryId),
          });
          /*
           * "Queued", not "Sent". The worker does the sending a moment later,
           * and claiming success here would be a promise this button cannot
           * keep — the very failure mode this panel exists to expose.
           */
          toast({
            title: "Queued for sending",
            description: `${LABELS[n.templateKey] ?? n.templateKey} to ${n.recipient}.`,
          });
        },
        onError: (err) =>
          toast({
            title: "Could not queue the message",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded bg-card" />;
  }

  if (!data || data.length === 0) {
    return (
      <p className="font-sans text-xs text-muted-foreground">
        No messages were queued for this enquiry. If it predates automatic
        notifications, that is expected.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid={`notifications-${enquiryId}`}>
      {data.map((n) => (
        <div
          key={n.id}
          data-testid={`notification-${n.id}`}
          className="flex items-start justify-between gap-4 border border-border/40 rounded-sm px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm text-foreground">
                {LABELS[n.templateKey] ?? n.templateKey}
              </span>
              <StatusText status={n.status} />
            </div>
            <p className="font-sans text-xs text-muted-foreground truncate">
              {n.recipient}
            </p>
            {n.sentAt && (
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(n.sentAt), "d MMM yyyy 'at' h:mm a")}
              </p>
            )}
            {/*
              The server's own words, verbatim. "Failed" alone sends someone
              hunting through logs; "Invalid login: 535 authentication failed"
              tells them to fix the password.
            */}
            {n.lastError && (
              <p className="font-sans text-[11px] text-destructive mt-1 break-words">
                {n.lastError}
                {n.attempts > 1 ? ` (${n.attempts} attempts)` : ""}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleResend(n)}
            disabled={resend.isPending}
            data-testid={`resend-${n.id}`}
            className="font-sans text-[10px] uppercase tracking-widest shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            {n.status === "sent" ? "Send again" : "Retry"}
          </Button>
        </div>
      ))}
    </div>
  );
}
