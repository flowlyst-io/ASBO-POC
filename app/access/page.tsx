"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

/** Only allow same-origin relative redirect targets (defends against open redirect). */
function safeNext(next: string | null): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/";
}

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Access denied (${res.status})`);
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <LockOutlinedIcon sx={{ color: "primary.main" }} />
        <Typography component="h1" sx={{ fontSize: 20, fontWeight: 500 }}>
          Access required
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 3 }}>
        Enter the access code to open the Flowlyst COE Review workspace.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          label="Access code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          fullWidth
          autoFocus
          autoComplete="current-password"
          disabled={submitting}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting || code.length === 0}
          sx={{ mt: 2.5 }}
        >
          {submitting ? "Checking…" : "Continue"}
        </Button>
      </Box>
    </Paper>
  );
}

/** Access-code gate page (redirected here by middleware when the cookie is missing). */
export default function AccessPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <React.Suspense fallback={null}>
        <AccessForm />
      </React.Suspense>
    </Box>
  );
}
