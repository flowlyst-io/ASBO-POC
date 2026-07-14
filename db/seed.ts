import { readFileSync } from "fs";
import path from "path";

import { and, eq } from "drizzle-orm";

import { getDb, schema } from "./client";

/**
 * Idempotent seed: ~40 placeholder COE criteria (v2025.1) + the 3 sample
 * ACFR applications/documents from samples/manifest.json. The PDF bytes stay
 * in ./samples; the demo API copies them into blob storage when a run needs
 * them (documents.storage_key points at the blob key).
 *
 * Run: npm run db:seed
 */

interface CriteriaFile {
  checklistVersion: string;
  criteria: Array<{
    num: string;
    section: "introductory" | "financial" | "statistical" | "compliance";
    title: string;
    description: string;
  }>;
}

interface ManifestFile {
  samples: Array<{
    id: string;
    file: string;
    districtName: string;
    state: string;
    fiscalYearEnd: string;
    pages: number;
    textQuality: "clean" | "degraded";
  }>;
}

async function main() {
  const db = await getDb();

  // --- Criteria -------------------------------------------------------------
  const criteriaFile = JSON.parse(
    readFileSync(path.join(process.cwd(), "db", "seed-criteria.json"), "utf8"),
  ) as CriteriaFile;

  let criteriaInserted = 0;
  for (const [i, c] of criteriaFile.criteria.entries()) {
    const existing = await db
      .select({ id: schema.criteria.id })
      .from(schema.criteria)
      .where(
        and(
          eq(schema.criteria.checklistVersion, criteriaFile.checklistVersion),
          eq(schema.criteria.num, c.num),
        ),
      );
    if (existing.length > 0) continue;
    await db.insert(schema.criteria).values({
      checklistVersion: criteriaFile.checklistVersion,
      num: c.num,
      section: c.section,
      title: c.title,
      description: c.description,
      sortOrder: i,
    });
    criteriaInserted += 1;
  }

  // --- Sample applications + documents ---------------------------------------
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "samples", "manifest.json"), "utf8"),
  ) as ManifestFile;

  let samplesInserted = 0;
  for (const sample of manifest.samples) {
    const storageKey = `samples/${sample.file}`;
    const existing = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.storageKey, storageKey));
    if (existing.length > 0) continue;

    const [app] = await db
      .insert(schema.applications)
      .values({
        districtName: sample.districtName,
        state: sample.state,
        fiscalYearEnd: sample.fiscalYearEnd,
        status: "intake",
      })
      .returning();

    const localPath = path.join(process.cwd(), "samples", sample.file);
    const sizeBytes = readFileSync(localPath).byteLength;

    await db.insert(schema.documents).values({
      applicationId: app.id,
      kind: "acfr",
      filename: sample.file,
      storageKey,
      sizeBytes,
      textQuality: "unknown", // extraction determines the real value
    });
    samplesInserted += 1;
  }

  // --- Reviewers ---------------------------------------------------------------
  // Placeholder volunteer roster. One reviewer per sample state so the
  // own-state recusal rule is demoable; Rita Morales is the demo persona
  // behind the top-bar "RM" avatar. No assignments are seeded — assigning
  // is part of the demo flow.
  const REVIEWERS = [
    { name: "Rita Morales", state: "OH", title: "CFO, Westlake City Schools", isDemo: true },
    { name: "Dan Whitfield", state: "IL", title: "Director of Business Services, Peoria PSD", isDemo: false },
    { name: "Karen Ostrowski", state: "IA", title: "Business Manager, Cedar Rapids CSD", isDemo: false },
    { name: "Priya Raman", state: "GA", title: "Comptroller, Cobb County Schools", isDemo: false },
    { name: "Marcus Lee", state: "TX", title: "Executive Director of Finance, Plano ISD", isDemo: false },
    { name: "Elaine Fujimoto", state: "WA", title: "Director of Fiscal Services, Bellevue SD", isDemo: false },
  ];

  let reviewersInserted = 0;
  for (const r of REVIEWERS) {
    const existing = await db
      .select({ id: schema.reviewers.id })
      .from(schema.reviewers)
      .where(eq(schema.reviewers.name, r.name));
    if (existing.length > 0) continue;
    await db.insert(schema.reviewers).values(r);
    reviewersInserted += 1;
  }

  const [criteriaCount, appCount, docCount, reviewerCount] = await Promise.all([
    db.select({ id: schema.criteria.id }).from(schema.criteria),
    db.select({ id: schema.applications.id }).from(schema.applications),
    db.select({ id: schema.documents.id }).from(schema.documents),
    db.select({ id: schema.reviewers.id }).from(schema.reviewers),
  ]);

  console.log(
    `Seed complete. criteria: ${criteriaCount.length} (+${criteriaInserted}), applications: ${appCount.length}, documents: ${docCount.length} (+${samplesInserted}), reviewers: ${reviewerCount.length} (+${reviewersInserted}).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
