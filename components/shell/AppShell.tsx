"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import StreamIcon from "@mui/icons-material/Stream";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import GroupsIcon from "@mui/icons-material/Groups";
import InsightsIcon from "@mui/icons-material/Insights";
import RateReviewIcon from "@mui/icons-material/RateReview";
import HistoryIcon from "@mui/icons-material/History";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

import { useNavCounts } from "@/lib/hooks/useNavCounts";

const TOP_BAR_HEIGHT = 60;
const NAV_RAIL_WIDTH = 232;

type CountKey = "applications" | "assignedToMe" | "completed";

interface NavEntry {
  label: string;
  icon: React.ReactNode;
  href: string;
  countKey?: CountKey;
}

const WORKSPACE_NAV: NavEntry[] = [
  { label: "Dashboard", icon: <DashboardIcon />, href: "/dashboard" },
  { label: "Applications", icon: <FactCheckIcon />, href: "/", countKey: "applications" },
  { label: "Reviewers", icon: <GroupsIcon />, href: "/reviewers" },
  { label: "Metrics", icon: <InsightsIcon />, href: "/metrics" },
];

const QUEUE_NAV: NavEntry[] = [
  { label: "Assigned to me", icon: <RateReviewIcon />, href: "/queue/assigned", countKey: "assignedToMe" },
  { label: "Completed", icon: <HistoryIcon />, href: "/queue/completed", countKey: "completed" },
];

/**
 * Top-bar search: filters the applications list by district/state. Enter
 * navigates to /?q=… from anywhere; the home page reads the param and
 * filters client-side. Needs its own Suspense boundary (useSearchParams).
 */
function TopBarSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const submit = () => {
    const term = q.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
  };

  return (
    <TextField
      size="small"
      placeholder="Search applications, districts…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
      }}
      sx={{ width: 300 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/** "/" owns the applications list plus the intake and review flows. */
function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/intake") || pathname.startsWith("/review");
  }
  return pathname.startsWith(href);
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: string;
  active?: boolean;
  href: string;
}

function NavItem({ icon, label, count, active = false, href }: NavItemProps) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2.5,
        py: 1.25,
        position: "relative",
        cursor: "pointer",
        textDecoration: "none",
        bgcolor: active ? "rgba(25,118,210,0.1)" : "transparent",
        "&:hover": { bgcolor: active ? "rgba(25,118,210,0.1)" : "action.hover" },
        "&::before": active
          ? {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              bgcolor: "primary.main",
            }
          : undefined,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: active ? "primary.dark" : "text.secondary",
          "& svg": { fontSize: 22 },
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontSize: 14,
          fontWeight: active ? 500 : 400,
          color: active ? "primary.dark" : "text.primary",
        }}
      >
        {label}
      </Typography>
      {count !== undefined && (
        <Box
          sx={{
            px: 1,
            py: 0.1,
            borderRadius: "10px",
            fontSize: 12,
            fontWeight: 500,
            bgcolor: active ? "primary.main" : "action.selected",
            color: active ? "primary.contrastText" : "text.secondary",
          }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
}

function NavOverline({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        px: 2.5,
        pt: 2.5,
        pb: 0.5,
        fontSize: 11,
        letterSpacing: 1,
        color: "text.secondary",
      }}
    >
      {children}
    </Typography>
  );
}

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * App shell used by all screens: fixed 60px top app bar + 232px left nav
 * rail. Children render in the main area (a flex column with overflow hidden;
 * pages manage their own internal scrolling). Nav badges and the avatar
 * initials come from GET /api/nav/counts (no pill until loaded).
 */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { data: counts } = useNavCounts();

  const renderNav = (items: NavEntry[]) =>
    items.map((item) => (
      <NavItem
        key={item.href}
        icon={item.icon}
        label={item.label}
        href={item.href}
        active={isNavActive(item.href, pathname)}
        count={item.countKey && counts ? String(counts[item.countKey]) : undefined}
      />
    ));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={2}
        sx={{ bgcolor: "background.paper", color: "text.primary", zIndex: 20 }}
      >
        <Toolbar sx={{ minHeight: TOP_BAR_HEIGHT, height: TOP_BAR_HEIGHT, gap: 1.5 }}>
          <IconButton edge="start" aria-label="menu" size="small" sx={{ color: "text.secondary" }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StreamIcon sx={{ fontSize: 20, color: "primary.contrastText" }} />
            </Box>
            <Typography sx={{ fontSize: 20, fontWeight: 500 }}>Flowlyst</Typography>
          </Box>
          <Typography sx={{ color: "text.disabled", fontSize: 18, fontWeight: 300 }}>/</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 500, color: "text.primary" }}>
            COE Review
          </Typography>

          <Box sx={{ flex: 1 }} />

          <React.Suspense fallback={<Box sx={{ width: 300 }} />}>
            <TopBarSearch />
          </React.Suspense>
          <IconButton size="small" aria-label="help" sx={{ color: "text.secondary" }}>
            <HelpOutlineIcon />
          </IconButton>
          <IconButton size="small" aria-label="notifications" sx={{ color: "text.secondary" }}>
            <Badge color="error" variant="dot" overlap="circular">
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              fontSize: 14,
              bgcolor: "secondary.main",
            }}
          >
            {counts?.me.initials ?? "RM"}
          </Avatar>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0, mt: `${TOP_BAR_HEIGHT}px` }}>
        <Box
          component="nav"
          sx={{
            width: NAV_RAIL_WIDTH,
            flexShrink: 0,
            bgcolor: "background.paper",
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <NavOverline>Workspace</NavOverline>
          {renderNav(WORKSPACE_NAV)}

          <NavOverline>My queue</NavOverline>
          {renderNav(QUEUE_NAV)}

          <Box sx={{ mt: "auto", p: 1.5 }}>
            <Box
              sx={{
                bgcolor: "background.default",
                borderRadius: "8px",
                p: 1.5,
                display: "flex",
                gap: 1.25,
                alignItems: "flex-start",
              }}
            >
              <VerifiedUserIcon sx={{ fontSize: 20, color: "info.main", mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>
                  Human-in-the-loop
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                  AI prepares findings. You decide every outcome.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
