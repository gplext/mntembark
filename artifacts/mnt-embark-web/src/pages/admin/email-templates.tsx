import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmailTemplates,
  useUpdateEmailTemplate,
  usePreviewEmailTemplate,
  getListEmailTemplatesQueryKey,
} from "@workspace/api-client-react";
import type { EmailTemplate, EmailPreview } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { format } from "date-fns";
import AdminLayout from "@/components/AdminLayout";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * Editing what the automatic emails say.
 *
 * The preview is the reason this screen is worth building rather than a config
 * file. Without it the only way to find out what an edit produces is to send a
 * real message to a real person, and the only way to find out what it broke is
 * for a client to receive it.
 */

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div
      data-testid="template-warnings"
      className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2"
    >
      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
      <p className="font-sans text-xs text-destructive leading-relaxed">
        {warnings.length === 1 ? "This name isn't" : "These names aren't"}{" "}
        something the site can fill in, so {warnings.length === 1 ? "it" : "they"}{" "}
        will send as nothing:{" "}
        <span className="font-mono">{warnings.join(", ")}</span>
      </p>
    </div>
  );
}

function Editor({ template }: { template: EmailTemplate }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const save = useUpdateEmailTemplate();
  const preview = usePreviewEmailTemplate();

  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [rendered, setRendered] = useState<EmailPreview | null>(null);

  // Switching templates in the sidebar must not carry the previous one's text.
  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
    setRendered(null);
  }, [template.key, template.subject, template.body]);

  const isDirty = subject !== template.subject || body !== template.body;
  const matchesDefault =
    subject === template.defaultSubject && body === template.defaultBody;

  /*
   * Re-render on a pause in typing rather than on every keystroke: one request
   * per character would be both wasteful and unreadable, and a preview that
   * lags a word behind is worse than one that settles.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      preview.mutate(
        { key: template.key, data: { subject, body } },
        { onSuccess: setRendered },
      );
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.key, subject, body]);

  const handleSave = () => {
    save.mutate(
      { key: template.key, data: { subject, body } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListEmailTemplatesQueryKey(),
          });
          toast({
            title: "Wording saved",
            description: `${template.name} will use this from the next message onwards.`,
          });
        },
        onError: (err) =>
          toast({
            title: "Could not save",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleReset = () => {
    setSubject(template.defaultSubject);
    setBody(template.defaultBody);
  };

  const insert = (name: string) => {
    setBody((current) => `${current}{{${name}}}`);
  };

  const warnings = rendered?.warnings ?? template.warnings ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8" data-testid={`editor-${template.key}`}>
      {/* Editing */}
      <div className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-light text-foreground">
            {template.name}
          </h2>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            {template.description}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-testid="template-subject"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Message
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            data-testid="template-body"
            className="bg-background border-border/60 font-mono text-xs leading-relaxed"
          />
        </div>

        <Warnings warnings={warnings} />

        <div className="space-y-2">
          <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Insert a detail
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.placeholders.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => insert(name)}
                data-testid={`placeholder-${name}`}
                className="font-mono text-[11px] px-2 py-1 rounded-sm border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {`{{${name}}}`}
              </button>
            ))}
          </div>
          {/*
            Sections are the one piece of syntax that isn't self-evident, and
            the one that prevents the commonest ugly email: a heading printed
            above a blank space when the visitor left the message box empty.
          */}
          <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
            Wrap optional parts in{" "}
            <span className="font-mono">{`{{#notes}}`}</span> …{" "}
            <span className="font-mono">{`{{/notes}}`}</span> and they appear
            only when that detail exists.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={!isDirty || save.isPending}
            data-testid="save-template"
            className="font-sans text-xs uppercase tracking-widest gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={matchesDefault}
            data-testid="reset-template"
            className="font-sans text-xs uppercase tracking-widest gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore original
          </Button>
          {template.updatedAt && (
            <span className="font-sans text-[11px] text-muted-foreground ml-auto">
              Edited {format(new Date(template.updatedAt), "d MMM yyyy")}
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview — with a sample enquiry
        </p>
        <div className="border border-border/40 rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-card/50">
            <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
              Subject
            </p>
            <p
              data-testid="preview-subject"
              className="font-sans text-sm text-foreground mt-0.5"
            >
              {rendered?.subject ?? "…"}
            </p>
          </div>
          {/*
            An iframe, because the preview is a whole HTML document with its own
            colours and its own <body>. Rendering it inline would let the admin
            panel's styles leak in and show something the recipient will not see.
            Sandboxed with no allowances: nothing here needs to run.
          */}
          <iframe
            title="Email preview"
            data-testid="preview-html"
            sandbox=""
            srcDoc={rendered?.html ?? ""}
            className="w-full h-[520px] bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminEmailTemplatesPage() {
  const { data, isLoading } = useListEmailTemplates();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(
    () => data?.find((t) => t.key === selectedKey) ?? data?.[0] ?? null,
    [data, selectedKey],
  );

  return (
    <AdminLayout>
      <div className="px-8 py-7 max-w-[1500px]">
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-light text-foreground">
            Email wording
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            What the site says when someone enquires. Changes apply to the next
            message sent; anything already queued keeps the wording it was
            written with.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded bg-card" />
        ) : !data || data.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">
            No templates were found.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {data.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedKey(t.key)}
                  data-testid={`template-tab-${t.key}`}
                  className={cn(
                    "font-sans text-xs uppercase tracking-widest px-3 py-2 rounded-sm border transition-colors",
                    selected?.key === t.key
                      ? "border-primary/50 text-primary bg-primary/5"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.name}
                  {t.isCustomised && (
                    <span className="ml-2 text-[9px] text-primary/70">edited</span>
                  )}
                </button>
              ))}
            </div>

            <Separator className="bg-border/30 mb-7" />

            {selected && <Editor key={selected.key} template={selected} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
