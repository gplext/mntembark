import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@workspace/mnt-embark/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/mnt-embark/components/ui/select";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { useCreateEnquiry } from "@workspace/api-client-react";
import type { EnquiryInputEnquiryType } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const enquirySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  enquiryType: z.string().min(1, "Please select an enquiry type"),
  budget: z.string().optional(),
  message: z.string().min(10, "Please provide a message of at least 10 characters"),
});

type EnquiryFormData = z.infer<typeof enquirySchema>;

export default function ContactPage() {
  const { toast } = useToast();
  const createEnquiry = useCreateEnquiry();

  const form = useForm<EnquiryFormData>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      enquiryType: "",
      budget: "",
      message: "",
    },
  });

  const onSubmit = (data: EnquiryFormData) => {
    createEnquiry.mutate(
      {
        data: {
          source: "contact",
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone?.trim() || null,
          notes: data.message,
          enquiryType: data.enquiryType as EnquiryInputEnquiryType,
          budget: data.budget?.trim() || null,
          // Contact form has no consent flow — default to false
          acceptPrivacy: false,
          receiveUpdates: false,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Enquiry Received",
            description:
              "Thank you for your interest. A member of our team will be in touch within 24 hours.",
          });
          form.reset();
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "We were unable to send your enquiry. Please try again or contact us directly.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-16 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Get in Touch
          </p>
          <h1 className="font-serif text-6xl font-light text-foreground mb-4">
            Contact Us
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-xl">
            Every extraordinary journey begins with a conversation. Tell us your vision — we'll compose the rest.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-16">
          {/* Form */}
          <div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
                data-testid="contact-form"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                          First Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-first-name"
                            className="bg-card border-border/60 font-sans text-sm focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage className="font-sans text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                          Last Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-last-name"
                            className="bg-card border-border/60 font-sans text-sm focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage className="font-sans text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          data-testid="input-email"
                          className="bg-card border-border/60 font-sans text-sm focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage className="font-sans text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Phone (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          data-testid="input-phone"
                          className="bg-card border-border/60 font-sans text-sm focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage className="font-sans text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enquiryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Enquiry Type
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger
                            data-testid="select-enquiry-type"
                            className="bg-card border-border/60 font-sans text-sm focus:ring-primary"
                          >
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="tour-booking">Tour Booking</SelectItem>
                          <SelectItem value="custom-journey">Custom Journey Design</SelectItem>
                          <SelectItem value="membership">Membership Enquiry</SelectItem>
                          <SelectItem value="corporate">Corporate Travel</SelectItem>
                          <SelectItem value="general">General Enquiry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="font-sans text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Approximate Budget (Optional)
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger
                            data-testid="select-budget"
                            className="bg-card border-border/60 font-sans text-sm focus:ring-primary"
                          >
                            <SelectValue placeholder="Select range..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="10k-25k">$10,000 — $25,000</SelectItem>
                          <SelectItem value="25k-50k">$25,000 — $50,000</SelectItem>
                          <SelectItem value="50k-100k">$50,000 — $100,000</SelectItem>
                          <SelectItem value="100k+">$100,000+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="font-sans text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Your Vision
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="textarea-message"
                          rows={5}
                          placeholder="Tell us about your dream journey..."
                          className="bg-card border-border/60 font-sans text-sm focus-visible:ring-primary placeholder:text-muted-foreground/50 resize-none"
                        />
                      </FormControl>
                      <FormMessage className="font-sans text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  data-testid="contact-submit"
                  disabled={form.formState.isSubmitting || createEnquiry.isPending}
                  className="w-full font-sans text-xs uppercase tracking-widest h-12"
                >
                  {createEnquiry.isPending ? "Sending..." : "Send Enquiry"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Info */}
          <div className="space-y-10">
            <div>
              <div className="w-12 h-px bg-primary mb-6" />
              <h2 className="font-serif text-3xl font-light text-foreground mb-4">
                Our Promise
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                Every enquiry is handled personally by a senior member of our team. We respond within 24 hours — often sooner. We never use automated responses. Your journey deserves a human conversation.
              </p>
            </div>

            <Separator className="bg-border/20" />

            <div className="space-y-6">
              <div>
                <p className="font-sans text-xs uppercase tracking-widest text-primary mb-2">
                  Direct Reservations
                </p>
                <p className="font-sans text-sm text-foreground/80">
                  reservations@mntembark.com
                </p>
              </div>
              <div>
                <p className="font-sans text-xs uppercase tracking-widest text-primary mb-2">
                  Member Services
                </p>
                <p className="font-sans text-sm text-foreground/80">
                  +1 (800) MNT-EMBARK
                </p>
                <p className="font-sans text-xs text-muted-foreground mt-1">
                  Available 24 hours, 7 days a week
                </p>
              </div>
              <div>
                <p className="font-sans text-xs uppercase tracking-widest text-primary mb-2">
                  Global Offices
                </p>
                <p className="font-sans text-sm text-foreground/80">
                  New York · London · Dubai · Singapore
                </p>
              </div>
            </div>

            <Separator className="bg-border/20" />

            <div className="bg-card/40 border border-border/40 rounded p-6">
              <p className="font-serif text-lg font-light text-foreground mb-3">
                Private Consultation
              </p>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                For journeys exceeding $50,000, we offer a complimentary private consultation with our Founder. Available in person in New York or London, or via secure video.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
