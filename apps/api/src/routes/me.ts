import { Hono } from "hono";
import { ProfilePatchSchema, type Profile } from "@entri/types";
import type { AppEnv } from "../middleware/auth.js";
import { orThrow } from "../utils/index.js";

export const me = new Hono<AppEnv>();

// GET /v1/me — profile, bootstrapping defaults (profile + srs_params + streaks)
// on first call so a freshly-signed-up user is ready to study.
me.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  let profile = orThrow(
    await db.database.from("profiles").select().eq("user_id", userId).maybeSingle()
  );

  if (!profile) {
    profile = orThrow(
      await db.database.from("profiles").insert([{ user_id: userId }]).select().single()
    );
    // Sibling per-user rows; ignore conflicts if a parallel call raced us.
    await db.database.from("srs_params").insert([{ user_id: userId }]);
    await db.database.from("streaks").insert([{ user_id: userId }]);
  }

  return c.json(profile as Profile);
});

// PATCH /v1/me — update product config (exam date, IANA tz, study hour, names).
me.patch("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate + strip to known fields against the shared contract (unknown keys
  // are dropped by the schema, so the DB only ever sees updatable columns).
  const parsed = ProfilePatchSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid profile fields" }, 400);
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) return c.json({ error: "no updatable fields" }, 400);

  const updated = orThrow(
    await db.database.from("profiles").update(patch).eq("user_id", userId).select().single()
  );
  return c.json(updated as Profile);
});
