"use client";

import Avatar from "@mui/material/Avatar";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { useResident } from "@/context/ResidentContext";
import { getResidentInitials } from "@/lib/resident";
import {
  RESIDENT_SIDEBAR_WIDTH,
  RESIDENT_SIDEBAR_WIDTH_COLLAPSED,
} from "@/components/resident/ResidentSidebar";

interface ResidentHeaderProps {
  /** Whether the desktop drawer is expanded. */
  expanded: boolean;
  /** Toggle the desktop drawer's collapsed/expanded state. */
  onToggleDrawer: () => void;
  /** Open the mobile drawer (hamburger menu). */
  onOpenMobile: () => void;
  /** Number of unread notifications (header badge). */
  unreadNotifications: number;
  /** Page title shown on desktop. */
  title: string;
}

/**
 * Top app bar for the resident shell.
 *
 * Follows the Figma mobile header: hamburger menu on the left, notification
 * bell and profile avatar on the right. On desktop it adds the page title and
 * the accessibility controls, and the hamburger becomes a collapse toggle for
 * the persistent sidebar.
 */
export function ResidentHeader({
  expanded,
  onToggleDrawer,
  onOpenMobile,
  unreadNotifications,
  title,
}: ResidentHeaderProps) {
  const { profile } = useResident();
  // The header is `position: fixed`, so it must track the drawer's actual
  // width: 280px when expanded, 72px (icons only) when collapsed.
  const drawerWidth = expanded
    ? RESIDENT_SIDEBAR_WIDTH
    : RESIDENT_SIDEBAR_WIDTH_COLLAPSED;

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        transition: (theme) =>
          theme.transitions.create(["width", "margin-left"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: 64 }}>
        {/* Desktop: collapse/expand persistent drawer. */}
        <IconButton
          onClick={onToggleDrawer}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          sx={{ display: { xs: "none", md: "inline-flex" } }}
        >
          {expanded ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>

        {/* Mobile: open temporary drawer. */}
        <IconButton
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          sx={{ display: { xs: "inline-flex", md: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="h6"
          component="h1"
          sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }}
        >
          {title}
        </Typography>

        {/* Spacer keeps the right-hand icons in place on mobile (no title). */}
        <Box sx={{ flexGrow: 1, display: { xs: "block", sm: "none" } }} />

        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <AccessibilityControls />
        </Box>

        <Tooltip title="Notifications">
          <IconButton
            component={Link}
            href="/notifications"
            aria-label={`Notifications: ${unreadNotifications} unread`}
            color="inherit"
          >
            <Badge
              badgeContent={unreadNotifications}
              color="error"
              overlap="circular"
              max={99}
            >
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Account settings">
          <IconButton
            component={Link}
            href="/settings"
            aria-label="Account settings"
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={profile?.profileImageUrl}
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                fontSize: 14,
              }}
            >
              {getResidentInitials(profile)}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
