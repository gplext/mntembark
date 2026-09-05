import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEnquiries,
  useUpdateEnquiryStatus,
  getListEnquiriesQueryKey,
} from "@workspace/api-client-react";
import type { Enquiry } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { format } from "date-fns";
import { Mail, Phone, CheckCircle, RotateCcw, MapPin, Clock, Calendar } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { NotificationPanel } from "@/components/NotificationPanel";
import { TestEmailButton } from "@/components/TestEmailButton";

type StatusFilter = "all" | "new" | "handled";

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function buildMailtoHref(enquiry: Enquiry): string {
  const name = [enquiry.title, enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ");
  const subject = enquiry.tourTitle
    ? `Re: Enquiry — ${enquiry.tourTitle}`
    : `Re: Your Enquiry to MNT Embark`;
  const body = [
    `Dear ${enquiry.firstName},`,
    "",
    "Thank you for reaching out to MNT Embark.",
    "",
    enquiry.tourTitle ? `We have received your enquiry regarding ${enquiry.tourTitle}.` : "",
    "",
    "We look forward to speaking with you.",
    "",
    "Warm regards,",
    "MNT Embark",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildWhatsAppHref(enquiry: Enquiry): string | null {
  if (!enquiry.phone) return null;
  const digits = normalizePhone(enquiry.phone);
  if (!digits || digits.length < 7) return null;
  const name = enquiry.firstName;
  const text = enquiry.tourTitle
    ? `Hello ${name}, this is MNT Embark. Thank you for your enquiry about ${enquiry.tourTitle}. We would love to discuss this further with you.`
    : `Hello ${name}, this is MNT Embark. Thank you for your enquiry. We would love to discuss this with you.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function EnquirySourceBadge({ source }: { source: Enquiry["source"] }) {
  return (
    <span
      className={cn(
        "inline-block font-sans text-[9px] font-semibold tracking-[0.18em] uppercase px-2 py-0.5 rounded-sm border",
        source === "tour"
          ? "border-primary/30 bg-primary/8 text-primary"
          : "border-border/60 bg-card text-muted-foreground"
      )}
    >
      {source === "tour" ? "Tour Enquiry" : "Contact Form"}
    </span>
  );
}

function EnquiryStatusBadge({ status }: { status: Enquiry["status"] }) {
  return (
    <Badge
      variant={status === "new" ? "default" : "secondary"}
      className={cn(
        "font-sans text-[9px] tracking-[0.15em] uppercase rounded-sm",
        status === "new"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status === "new" ? "New" : "Handled"}
    </Badge>
  );
}

function EnquiryRow({
  enquiry,
  selected,
  onSelect,
}: {
  enquiry: Enquiry;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = [enquiry.title, enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      data-testid={`enquiry-row-${enquiry.id}`}
      onClick={onSelect}
      className={cn(
        "w-full text-left px-5 py-4 border-b border-border/30 transition-colors duration-150",
        selected
          ? "bg-primary/6 border-l-2 border-l-primary"
          : "hover:bg-card/60 border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-sans text-sm font-medium text-foreground truncate">{name}</p>
            {enquiry.status === "new" && (
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </div>
          <p className="font-sans text-xs text-muted-foreground truncate">{enquiry.email}</p>
          {enquiry.tourTitle && (
            <p className="font-sans text-xs text-primary/80 truncate mt-0.5">{enquiry.tourTitle}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <EnquirySourceBadge source={enquiry.source} />
          <p className="font-sans text-[10px] text-muted-foreground">
            {format(new Date(enquiry.createdAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>
    </button>
  );
}

function EnquiryDetail({ enquiry }: { enquiry: Enquiry }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateStatus = useUpdateEnquiryStatus();

  const name = [enquiry.title, enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ");
  const mailtoHref = buildMailtoHref(enquiry);
  const whatsappHref = buildWhatsAppHref(enquiry);
  const isNew = enquiry.status === "new";

  const handleStatusToggle = () => {
    const nextStatus = isNew ? "handled" : "new";
    updateStatus.mutate(
      { id: enquiry.id, data: { status: nextStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
          toast({
            title: nextStatus === "handled" ? "Marked as Handled" : "Reopened",
            description: `Enquiry from ${enquiry.firstName} ${enquiry.lastName} updated.`,
          });
        },
        onError: () =>
          toast({ title: "Update Failed", description: "Could not update status. Please try again.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="h-full overflow-y-auto" data-testid={`enquiry-detail-${enquiry.id}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-7 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <EnquirySourceBadge source={enquiry.source} />
              <EnquiryStatusBadge status={enquiry.status} />
            </div>
            <h2 className="font-serif text-2xl font-light text-foreground">{name}</h2>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Received {format(new Date(enquiry.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Button
            variant={isNew ? "default" : "outline"}
            size="sm"
            data-testid={`status-toggle-${enquiry.id}`}
            onClick={handleStatusToggle}
            disabled={updateStatus.isPending}
            className="font-sans text-xs uppercase tracking-widest shrink-0 gap-1.5"
          >
            {isNew ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                Mark Handled
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Reopen
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="px-7 py-6 space-y-7">
        {/* Contact actions */}
        <div className="flex gap-3">
          <a
            href={mailtoHref}
            data-testid={`email-action-${enquiry.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border/60 rounded-sm font-sans text-xs uppercase tracking-widest text-foreground hover:bg-card/60 hover:border-primary/40 transition-colors duration-150"
          >
            <Mail className="h-3.5 w-3.5 text-primary" />
            Send Email
          </a>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`whatsapp-action-${enquiry.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-border/60 rounded-sm font-sans text-xs uppercase tracking-widest text-foreground hover:bg-card/60 hover:border-primary/40 transition-colors duration-150"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              WhatsApp
            </a>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* What the site sent automatically, and whether it arrived. */}
        <section>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Delivery
          </p>
          <NotificationPanel enquiryId={enquiry.id} />
        </section>

        <Separator className="bg-border/30" />

        {/* Customer details */}
        <section>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Customer Details
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Full Name" value={name} testId={`detail-name-${enquiry.id}`} />
            <DetailField label="Email" value={enquiry.email} testId={`detail-email-${enquiry.id}`} />
            {enquiry.phone && (
              <DetailField label="Phone" value={enquiry.phone} testId={`detail-phone-${enquiry.id}`} />
            )}
            {enquiry.isTravelAdvisor !== null && enquiry.isTravelAdvisor !== undefined && (
              <DetailField
                label="Travel Advisor"
                value={enquiry.isTravelAdvisor ? "Yes" : "No"}
                testId={`detail-advisor-${enquiry.id}`}
              />
            )}
            <DetailField
              label="Privacy Accepted"
              value={enquiry.acceptPrivacy ? "Yes" : "No"}
              testId={`detail-privacy-${enquiry.id}`}
            />
            <DetailField
              label="Receive Updates"
              value={enquiry.receiveUpdates ? "Yes" : "No"}
              testId={`detail-updates-${enquiry.id}`}
            />
          </div>
        </section>

        {/* Tour context (tour enquiries only) */}
        {enquiry.source === "tour" && (enquiry.tourTitle || enquiry.tourLocation || enquiry.tourDurationDays) && (
          <>
            <Separator className="bg-border/30" />
            <section>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Tour Context
              </p>
              <div className="bg-card/50 border border-border/40 rounded-sm p-4 space-y-2">
                {enquiry.tourTitle && (
                  <p className="font-serif text-lg font-light text-foreground">{enquiry.tourTitle}</p>
                )}
                <div className="flex flex-wrap gap-4">
                  {enquiry.tourLocation && (
                    <span className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" />
                      {enquiry.tourLocation}
                    </span>
                  )}
                  {enquiry.tourDurationDays && (
                    <span className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary/70" />
                      {enquiry.tourDurationDays} Days
                    </span>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Contact form context (contact enquiries only) */}
        {enquiry.source === "contact" && (enquiry.enquiryType || enquiry.budget) && (
          <>
            <Separator className="bg-border/30" />
            <section>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Enquiry Context
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {enquiry.enquiryType && (
                  <DetailField label="Enquiry Type" value={enquiry.enquiryType} testId={`detail-type-${enquiry.id}`} />
                )}
                {enquiry.budget && (
                  <DetailField label="Budget Range" value={enquiry.budget} testId={`detail-budget-${enquiry.id}`} />
                )}
              </div>
            </section>
          </>
        )}

        {/* Notes */}
        {enquiry.notes && (
          <>
            <Separator className="bg-border/30" />
            <section>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                {enquiry.source === "contact" ? "Vision / Message" : "Travel Plans"}
              </p>
              <div
                data-testid={`detail-notes-${enquiry.id}`}
                className="bg-card/50 border border-border/40 rounded-sm px-4 py-3"
              >
                <p className="font-sans text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {enquiry.notes}
                </p>
              </div>
            </section>
          </>
        )}

        {/* Timeline */}
        <Separator className="bg-border/30" />
        <section>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Timeline
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 font-sans text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span>
                Received on{" "}
                <span className="text-foreground/80">
                  {format(new Date(enquiry.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </span>
            </div>
            {enquiry.handledAt && (
              <div className="flex items-center gap-3 font-sans text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                <span>
                  Handled on{" "}
                  <span className="text-foreground/80">
                    {format(new Date(enquiry.handledAt), "MMMM d, yyyy 'at' h:mm a")}
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </p>
      <p data-testid={testId} className="font-sans text-sm text-foreground/90">
        {value}
      </p>
    </div>
  );
}

function EnquiryListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-border/30">
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36 bg-card" />
              <Skeleton className="h-3 w-48 bg-card" />
            </div>
            <div className="space-y-1.5 items-end flex flex-col">
              <Skeleton className="h-4 w-20 bg-card" />
              <Skeleton className="h-3 w-16 bg-card" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminEnquiriesPage() {
  const { data: enquiries, isLoading, isError, refetch } = useListEnquiries();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = enquiries
    ? enquiries.filter((e) => filter === "all" || e.status === filter)
    : [];

  const selectedEnquiry = filtered.find((e) => e.id === selectedId) ?? null;

  const newCount = enquiries ? enquiries.filter((e) => e.status === "new").length : 0;

  return (
    <AdminLayout>
      <div className="flex h-[100dvh] overflow-hidden" data-testid="admin-enquiries">
        {/* ── LEFT: list panel ── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-border/40 bg-background">
          {/* List header */}
          <div className="px-5 pt-6 pb-4 border-b border-border/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-primary mb-0.5">
                  Admin
                </p>
                <h1 className="font-serif text-xl font-light text-foreground">
                  Enquiries
                  {newCount > 0 && (
                    <span className="ml-2 font-sans text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5 align-middle">
                      {newCount}
                    </span>
                  )}
                </h1>
              </div>
              <TestEmailButton />
            </div>

            {/* Filter tabs */}
            <div
              className="flex border border-border/50 rounded-sm overflow-hidden"
              data-testid="enquiry-filter"
            >
              {(["all", "new", "handled"] as StatusFilter[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  data-testid={`filter-${tab}`}
                  onClick={() => {
                    setFilter(tab);
                    setSelectedId(null);
                  }}
                  className={cn(
                    "flex-1 py-2 font-sans text-[10px] uppercase tracking-widest transition-colors duration-150",
                    filter === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <EnquiryListSkeleton />
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                <p className="font-serif text-base font-light text-foreground mb-2">
                  Unable to Load Enquiries
                </p>
                <p className="font-sans text-xs text-muted-foreground mb-5">
                  An error occurred. Please try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  data-testid="retry-enquiries"
                  className="font-sans text-xs uppercase tracking-widest"
                >
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                <div className="w-10 h-px bg-primary/40 mb-5" />
                <p className="font-serif text-base font-light text-foreground mb-2">
                  {filter === "all" ? "No Enquiries Yet" : `No ${filter === "new" ? "New" : "Handled"} Enquiries`}
                </p>
                <p className="font-sans text-xs text-muted-foreground">
                  {filter === "all"
                    ? "Enquiries submitted via tours or the contact form will appear here."
                    : "Switch filters to view other enquiries."}
                </p>
              </div>
            ) : (
              filtered.map((enquiry) => (
                <EnquiryRow
                  key={enquiry.id}
                  enquiry={enquiry}
                  selected={selectedId === enquiry.id}
                  onSelect={() => setSelectedId(enquiry.id)}
                />
              ))
            )}
          </div>

          {/* Count footer */}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border/40">
              <p className="font-sans text-[10px] text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "enquiry" : "enquiries"}
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: detail panel ── */}
        <div className="flex-1 overflow-hidden bg-background">
          {selectedEnquiry ? (
            <EnquiryDetail enquiry={selectedEnquiry} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-12 h-px bg-primary/30 mb-8" />
              <p className="font-serif text-2xl font-light text-foreground mb-3">
                Select an Enquiry
              </p>
              <p className="font-sans text-sm text-muted-foreground max-w-xs">
                Choose an enquiry from the list to review the customer details and take action.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
