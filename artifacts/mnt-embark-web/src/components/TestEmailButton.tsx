import { useState } from "react";
import { useSendTestEmail } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/mnt-embark/components/ui/dialog";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Send } from "lucide-react";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * Sends one real email on demand, to prove outgoing mail works.
 *
 * The alternative is submitting a fake enquiry through the public form and
 * hoping — which pollutes the enquiry list and still leaves you guessing when
 * nothing arrives, because a queued message looks identical to a doomed one.
 *
 * This path deliberately does not queue: the server sends inline and reports
 * what the mail server said, so a wrong password comes back as a wrong password
 * rather than a row that quietly retries for an hour.
 */
export function TestEmailButton() {
  const { toast } = useToast();
  const sendTest = useSendTestEmail();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendTest.mutate(
      { data: { to: to.trim() } },
      {
        onSuccess: () => {
          toast({
            title: "Test email sent",
            description: `The mail server accepted it for ${to.trim()}. If it does not arrive, check spam and your DNS records.`,
          });
          setOpen(false);
        },
        onError: (err) =>
          toast({
            title: "Could not send",
            description: apiErrorMessage(err, "The mail server refused it."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="test-email-btn"
          className="font-sans text-[10px] uppercase tracking-widest gap-1.5"
        >
          <Send className="h-3 w-3" />
          Test email
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-light text-foreground">
            Send a test email
          </DialogTitle>
          <DialogDescription className="font-sans text-sm text-muted-foreground">
            Confirms the server's mail settings are working, without creating an
            enquiry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-4">
          <Input
            required
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            data-testid="test-email-to"
            className="bg-background border-border/60 font-sans text-sm"
          />
          <Button
            type="submit"
            disabled={sendTest.isPending || !to.trim()}
            data-testid="test-email-send"
            className="w-full font-sans text-xs uppercase tracking-widest"
          >
            {sendTest.isPending ? "Sending..." : "Send"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
