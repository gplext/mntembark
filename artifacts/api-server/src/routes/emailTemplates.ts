import { Router, type IRouter } from "express";
import { db, emailTemplatesTable } from "@workspace/db";
import {
  UpdateEmailTemplateBody,
  UpdateEmailTemplateParams,
  PreviewEmailTemplateBody,
  PreviewEmailTemplateParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  TEMPLATE_DEFAULTS,
  isTemplateKey,
  previewOf,
  templateSummaries,
  templateWarnings,
} from "../lib/templates";

/**
 * Editing the wording of the automatic messages.
 *
 * Saving is deliberately permissive. The one rule the whole feature rests on is
 * that no edit here can stop a client being acknowledged, and refusing to store
 * a template does not serve that — the wording that sends is resolved at send
 * time with the shipped copy as the floor, so a bad save degrades to the
 * default rather than to silence. Problems come back as warnings the person can
 * see next to a preview of what they wrote.
 */

const router: IRouter = Router();

router.get("/admin/email-templates", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await templateSummaries();
  res.json(
    rows.map((t) => ({
      ...t,
      warnings: templateWarnings(t.key, t.subject, t.body),
    })),
  );
});

router.put(
  "/admin/email-templates/:key",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateEmailTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const key = params.data.key;
    if (!isTemplateKey(key)) {
      res.status(404).json({ error: "No such template" });
      return;
    }

    const parsed = UpdateEmailTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const subject = parsed.data.subject;
    const body = parsed.data.body;
    const def = TEMPLATE_DEFAULTS[key];

    /*
     * Storing the row even when it matches the default, rather than deleting
     * it, keeps "when was this last looked at" answerable. Blank fields are
     * stored blank on purpose: that is what resolution reads as "use the
     * shipped wording", so Reset is a save like any other.
     */
    await db
      .insert(emailTemplatesTable)
      .values({
        key,
        subject,
        body,
      })
      .onConflictDoUpdate({
        target: emailTemplatesTable.key,
        set: { subject, body, updatedAt: new Date() },
      });

    const effectiveSubject = subject.trim() ? subject : def.subject;
    const effectiveBody = body.trim() ? body : def.body;

    const [saved] = (await templateSummaries()).filter((t) => t.key === key);
    res.json({
      ...saved,
      warnings: templateWarnings(key, effectiveSubject, effectiveBody),
    });
  },
);

router.post(
  "/admin/email-templates/:key/preview",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = PreviewEmailTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const key = params.data.key;
    if (!isTemplateKey(key)) {
      res.status(404).json({ error: "No such template" });
      return;
    }

    const parsed = PreviewEmailTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    /*
     * Previews what is in the editor right now, unsaved — the point is to see
     * an edit before committing to it, and previewing the stored version would
     * answer a question nobody asked.
     */
    const def = TEMPLATE_DEFAULTS[key];
    const subject = parsed.data.subject.trim() ? parsed.data.subject : def.subject;
    const body = parsed.data.body.trim() ? parsed.data.body : def.body;

    res.json({
      ...previewOf(key, subject, body),
      warnings: templateWarnings(key, subject, body),
    });
  },
);

export default router;
