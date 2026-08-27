import { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@workspace/mnt-embark/components/ui/dialog";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Label } from "@workspace/mnt-embark/components/ui/label";
import { Checkbox } from "@workspace/mnt-embark/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@workspace/mnt-embark/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/mnt-embark/components/ui/select";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { X } from "lucide-react";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { useCreateEnquiry } from "@workspace/api-client-react";

interface Tour {
  title: string;
  coverImage: string;
  durationDays: number;
  location: string;
  featured?: boolean;
}

interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  tour: Tour;
}

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

const SECTION_LABEL =
  "font-sans text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3";

export default function EnquiryModal({ open, onClose, tour }: EnquiryModalProps) {
  const { toast } = useToast();
  const createEnquiry = useCreateEnquiry();

  const [form, setForm] = useState({
    title: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    isTravelAdvisor: "no" as "yes" | "no",
    notes: "",
    acceptPrivacy: false,
    receiveUpdates: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const clearError = (field: string) =>
    setErrors((prev) => ({ ...prev, [field]: "" }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Valid email required";
    if (!form.acceptPrivacy) e.acceptPrivacy = "Required";
    return e;
  };

  const resetForm = () => {
    setForm({
      title: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      isTravelAdvisor: "no",
      notes: "",
      acceptPrivacy: false,
      receiveUpdates: true,
    });
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    createEnquiry.mutate(
      {
        data: {
          source: "tour",
          ...(form.title ? { title: form.title } : {}),
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone.trim() || null,
          isTravelAdvisor: form.isTravelAdvisor === "yes",
          notes: form.notes.trim() || null,
          acceptPrivacy: form.acceptPrivacy,
          receiveUpdates: form.receiveUpdates,
          tourTitle: tour.title,
          tourLocation: tour.location,
          tourDurationDays: tour.durationDays,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Enquiry Received",
            description:
              "Thank you. A member of our team will be in touch within 24 hours.",
          });
          setTimeout(() => {
            resetForm();
            onClose();
          }, 800);
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "We were unable to send your enquiry. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isPending = createEnquiry.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPortal>
        <DialogOverlay />

        {/* Custom full-width content — bypasses DialogContent to avoid built-in X & padding */}
        <RadixDialog.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-5xl shadow-2xl overflow-hidden rounded-sm
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          style={{ height: "min(90vh, 720px)" }}
        >
          <div className="flex h-full">

            {/* ── LEFT PANEL: tour image ── */}
            <div className="relative w-[38%] shrink-0 overflow-hidden hidden sm:block">
              <img
                src={tour.coverImage}
                alt={tour.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/75" />

              <div className="absolute top-8 left-8">
                <h2 className="font-serif text-2xl font-light text-white drop-shadow">
                  Enquiry Form
                </h2>
              </div>

              <div className="absolute bottom-8 left-8 right-8">
                {tour.featured && (
                  <span className="inline-block border border-white/60 text-white font-sans text-[9px] tracking-[0.2em] uppercase px-3 py-1 mb-3">
                    Featured Journey
                  </span>
                )}
                <h3 className="font-serif text-3xl font-light text-white leading-tight mb-2">
                  {tour.title}
                </h3>
                <p className="font-sans text-[11px] text-white/80 tracking-[0.15em] uppercase mb-1">
                  {tour.durationDays} Days · {tour.location}
                </p>
              </div>
            </div>

            {/* ── RIGHT PANEL: form ── */}
            <div className="flex-1 bg-card overflow-y-auto relative">

              {/* Close button */}
              <RadixDialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                  data-testid="enquiry-modal-close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </RadixDialog.Close>

              <div className="px-8 py-7 md:px-10">
                <h2 className="font-serif text-3xl font-light text-foreground mb-7">
                  Enquiry Form
                </h2>

                <form onSubmit={handleSubmit} noValidate data-testid="enquiry-modal-form">

                  {/* ── GUEST INFORMATION ── */}
                  <p className={SECTION_LABEL}>Guest Information</p>

                  {/* Row 1: Title | First Name | Last Name */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {/* Title select */}
                    <Select
                      value={form.title}
                      onValueChange={(v) => set("title", v)}
                    >
                      <SelectTrigger
                        data-testid="enquiry-title"
                        className="font-sans text-sm bg-background border-border/60 focus:ring-ring h-[42px]"
                      >
                        <SelectValue placeholder="Title" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {TITLES.map((t) => (
                          <SelectItem key={t} value={t} className="font-sans text-sm">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* First Name */}
                    <div>
                      <Input
                        value={form.firstName}
                        onChange={(e) => { set("firstName", e.target.value); clearError("firstName"); }}
                        placeholder="First Name*"
                        data-testid="enquiry-first-name"
                        className={cn(
                          "font-sans text-sm bg-background h-[42px]",
                          errors.firstName ? "border-destructive focus-visible:ring-destructive" : "border-border/60 focus-visible:ring-ring"
                        )}
                      />
                      {errors.firstName && (
                        <p className="font-sans text-xs text-destructive mt-1">{errors.firstName}</p>
                      )}
                    </div>

                    {/* Last Name */}
                    <div>
                      <Input
                        value={form.lastName}
                        onChange={(e) => { set("lastName", e.target.value); clearError("lastName"); }}
                        placeholder="Last Name*"
                        data-testid="enquiry-last-name"
                        className={cn(
                          "font-sans text-sm bg-background h-[42px]",
                          errors.lastName ? "border-destructive focus-visible:ring-destructive" : "border-border/60 focus-visible:ring-ring"
                        )}
                      />
                      {errors.lastName && (
                        <p className="font-sans text-xs text-destructive mt-1">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Phone | Email */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div>
                      <Input
                        value={form.phone}
                        onChange={(e) => { set("phone", e.target.value); clearError("phone"); }}
                        placeholder="Phone Number*"
                        type="tel"
                        data-testid="enquiry-phone"
                        className={cn(
                          "font-sans text-sm bg-background h-[42px]",
                          errors.phone ? "border-destructive focus-visible:ring-destructive" : "border-border/60 focus-visible:ring-ring"
                        )}
                      />
                      {errors.phone && (
                        <p className="font-sans text-xs text-destructive mt-1">{errors.phone}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => { set("email", e.target.value); clearError("email"); }}
                        placeholder="Email Address*"
                        data-testid="enquiry-email"
                        className={cn(
                          "font-sans text-sm bg-background h-[42px]",
                          errors.email ? "border-destructive focus-visible:ring-destructive" : "border-border/60 focus-visible:ring-ring"
                        )}
                      />
                      {errors.email && (
                        <p className="font-sans text-xs text-destructive mt-1">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* ── TRAVEL ADVISOR? ── */}
                  <p className={SECTION_LABEL}>Are you a travel advisor?</p>
                  <RadioGroup
                    value={form.isTravelAdvisor}
                    onValueChange={(v) => set("isTravelAdvisor", v as "yes" | "no")}
                    className="flex items-center gap-6 mb-6"
                  >
                    {(["yes", "no"] as const).map((val) => (
                      <div key={val} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={val}
                          id={`advisor-${val}`}
                          data-testid={`enquiry-advisor-${val}`}
                        />
                        <Label
                          htmlFor={`advisor-${val}`}
                          className="font-sans text-sm text-foreground uppercase tracking-widest cursor-pointer"
                        >
                          {val}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {/* ── TRAVEL PLANS NOTES ── */}
                  <p className={SECTION_LABEL}>Tell us more about your travel plans</p>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Add a note"
                    rows={5}
                    data-testid="enquiry-notes"
                    className="font-sans text-sm bg-background border-border/60 focus-visible:ring-ring resize-none mb-5"
                  />

                  {/* ── CHECKBOXES ── */}
                  <div className="space-y-3 mb-6">

                    {/* Privacy Policy */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="accept-privacy"
                        checked={form.acceptPrivacy}
                        onCheckedChange={(checked) => {
                          set("acceptPrivacy", !!checked);
                          clearError("acceptPrivacy");
                        }}
                        data-testid="enquiry-accept-privacy"
                        className={cn(
                          "mt-0.5",
                          errors.acceptPrivacy ? "border-destructive" : ""
                        )}
                      />
                      <Label
                        htmlFor="accept-privacy"
                        className="font-sans text-sm text-foreground leading-snug cursor-pointer"
                      >
                        I accept the{" "}
                        <span className="underline">Privacy Policy</span>.
                      </Label>
                    </div>
                    {errors.acceptPrivacy && (
                      <p className="font-sans text-xs text-destructive pl-7">{errors.acceptPrivacy}</p>
                    )}

                    {/* Receive Updates */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="receive-updates"
                        checked={form.receiveUpdates}
                        onCheckedChange={(checked) => set("receiveUpdates", !!checked)}
                        data-testid="enquiry-receive-updates"
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="receive-updates"
                        className="font-sans text-sm text-foreground leading-snug cursor-pointer"
                      >
                        Yes! I would like to receive news, updates, and other information from MNT Embark.
                      </Label>
                    </div>
                  </div>

                  {/* ── SUBMIT ── */}
                  <Button
                    type="submit"
                    disabled={isPending}
                    data-testid="enquiry-modal-submit"
                    className="w-full font-sans text-xs tracking-[0.25em] uppercase h-12 mb-4"
                  >
                    {isPending ? "Sending..." : "Send to an expert"}
                  </Button>

                  {/* Disclaimer */}
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
                    By providing your contact information and submitting this form, you are authorizing MNT Embark to contact you with the requested information. By clicking the "Submit" button below you acknowledge that you have read and agreed to the Terms and Conditions.
                  </p>
                </form>
              </div>
            </div>

          </div>
        </RadixDialog.Content>
      </DialogPortal>
    </Dialog>
  );
}
