import { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@workspace/mnt-embark/components/ui/dialog";
import { X } from "lucide-react";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";

interface Tour {
  title: string;
  coverImage: string;
  durationDays: number;
  priceFrom: number;
  location: string;
  featured?: boolean;
}

interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  tour: Tour;
}

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

export default function EnquiryModal({ open, onClose, tour }: EnquiryModalProps) {
  const { toast } = useToast();

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
  const [submitted, setSubmitted] = useState(false);

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitted(true);
    toast({
      title: "Enquiry Received",
      description:
        "Thank you. A member of our team will be in touch within 24 hours.",
    });
    setTimeout(() => {
      setSubmitted(false);
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
      onClose();
    }, 800);
  };

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
              {/* Dark overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/75" />

              {/* "Enquiry Form" top-left label */}
              <div className="absolute top-8 left-8">
                <h2 className="font-serif text-2xl font-light text-white drop-shadow">
                  Enquiry Form
                </h2>
              </div>

              {/* Tour info — bottom */}
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
                <p className="font-sans text-sm text-white font-light">
                  From ${tour.priceFrom.toLocaleString()} per person.
                </p>
              </div>
            </div>

            {/* ── RIGHT PANEL: form ── */}
            <div className="flex-1 bg-white overflow-y-auto relative">

              {/* Close button */}
              <RadixDialog.Close
                className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-500" />
              </RadixDialog.Close>

              <div className="px-8 py-7 md:px-10">
                <h2 className="font-serif text-3xl font-light text-gray-900 mb-7">
                  Enquiry Form
                </h2>

                <form onSubmit={handleSubmit} noValidate>

                  {/* ── GUEST INFORMATION ── */}
                  <p className="font-sans text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-3">
                    Guest Information
                  </p>

                  {/* Row 1: Title | First Name | Last Name */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="relative">
                      <select
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                        className="w-full appearance-none border border-gray-300 px-3 py-[11px] text-sm text-gray-600 bg-white font-sans focus:outline-none focus:border-gray-500 cursor-pointer"
                      >
                        <option value="">Title*</option>
                        {TITLES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
                    </div>
                    <input
                      value={form.firstName}
                      onChange={(e) => { set("firstName", e.target.value); setErrors((p) => ({ ...p, firstName: "" })); }}
                      placeholder="First Name*"
                      className={`border px-3 py-[11px] text-sm font-sans focus:outline-none ${errors.firstName ? "border-red-400" : "border-gray-300 focus:border-gray-500"}`}
                    />
                    <input
                      value={form.lastName}
                      onChange={(e) => { set("lastName", e.target.value); setErrors((p) => ({ ...p, lastName: "" })); }}
                      placeholder="Last Name*"
                      className={`border px-3 py-[11px] text-sm font-sans focus:outline-none ${errors.lastName ? "border-red-400" : "border-gray-300 focus:border-gray-500"}`}
                    />
                  </div>

                  {/* Row 2: Phone | Email */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className={`flex items-center border ${errors.phone ? "border-red-400" : "border-gray-300 focus-within:border-gray-500"}`}>
                      <div className="flex items-center gap-1 px-3 border-r border-gray-300 shrink-0 select-none">
                        <span className="text-base leading-none">🌍</span>
                        <span className="text-gray-400 text-xs">▾</span>
                      </div>
                      <input
                        value={form.phone}
                        onChange={(e) => { set("phone", e.target.value); setErrors((p) => ({ ...p, phone: "" })); }}
                        placeholder="Phone Number*"
                        className="flex-1 px-3 py-[11px] text-sm font-sans focus:outline-none bg-white min-w-0"
                      />
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => { set("email", e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                      placeholder="Email Address*"
                      className={`border px-3 py-[11px] text-sm font-sans focus:outline-none ${errors.email ? "border-red-400" : "border-gray-300 focus:border-gray-500"}`}
                    />
                  </div>

                  {/* ── TRAVEL ADVISOR? ── */}
                  <p className="font-sans text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-3">
                    Are you a travel advisor?
                  </p>
                  <div className="flex items-center gap-6 mb-6">
                    {(["yes", "no"] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <span
                          onClick={() => set("isTravelAdvisor", val)}
                          className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            form.isTravelAdvisor === val
                              ? "border-gray-900"
                              : "border-gray-400"
                          }`}
                        >
                          {form.isTravelAdvisor === val && (
                            <span className="w-[9px] h-[9px] rounded-full bg-gray-900 block" />
                          )}
                        </span>
                        <span className="font-sans text-sm text-gray-700 uppercase tracking-widest">
                          {val}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* ── TRAVEL PLANS NOTES ── */}
                  <p className="font-sans text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-3">
                    Tell us more about your travel plans
                  </p>
                  <textarea
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Add a note"
                    rows={5}
                    className="w-full border border-gray-300 px-3 py-3 text-sm font-sans focus:outline-none focus:border-gray-500 resize-none mb-5"
                  />

                  {/* ── CHECKBOXES ── */}
                  <div className="space-y-3 mb-6">
                    {/* Privacy Policy */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => { set("acceptPrivacy", !form.acceptPrivacy); setErrors((p) => ({ ...p, acceptPrivacy: "" })); }}
                        className={`mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border rounded-sm transition-colors ${
                          form.acceptPrivacy
                            ? "bg-gray-900 border-gray-900"
                            : errors.acceptPrivacy
                            ? "border-red-400 bg-white"
                            : "border-gray-400 bg-white"
                        }`}
                      >
                        {form.acceptPrivacy && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-sans text-sm text-gray-700 leading-snug">
                        I accept the{" "}
                        <span className="underline cursor-pointer">Privacy Policy</span>.
                      </span>
                    </label>

                    {/* Receive Updates */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => set("receiveUpdates", !form.receiveUpdates)}
                        className={`mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border rounded-sm transition-colors ${
                          form.receiveUpdates
                            ? "bg-gray-900 border-gray-900"
                            : "border-gray-400 bg-white"
                        }`}
                      >
                        {form.receiveUpdates && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-sans text-sm text-gray-700 leading-snug">
                        Yes! I would like to receive news, updates, and other information from MNT Embark.
                      </span>
                    </label>
                  </div>

                  {/* ── SUBMIT ── */}
                  <button
                    type="submit"
                    disabled={submitted}
                    className="w-full bg-gray-900 text-white font-sans text-xs tracking-[0.25em] uppercase py-4 hover:bg-black transition-colors disabled:opacity-60 mb-4"
                  >
                    {submitted ? "Sending…" : "Speak to an Expert"}
                  </button>

                  {/* Disclaimer */}
                  <p className="font-sans text-[10px] text-gray-400 leading-relaxed">
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
