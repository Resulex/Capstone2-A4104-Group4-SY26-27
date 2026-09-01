"use client";

import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { WebSocketStatus } from "@/components/admin/WebSocketStatus";
import { WebSocketStatus as WebSocketStatusValue } from "@/hooks/useWebSocket";
import { SIDEBAR_WIDTH } from "@/components/admin/AdminSidebar";

interface AdminHeaderProps {
  /** Whether the desktop drawer is expanded. */
  expanded: boolean;
  /** Toggle the desktop drawer's collapsed/expanded state. */
  onToggleDrawer: () => void;
  /** Open the mobile drawer. */
  onOpenMobile: () => void;
  /** Number of pending incidents (shown as the notification badge). */
  pendingIncidents: number;
  /** Current WebSocket lifecycle state. */
  websocketStatus: WebSocketStatusValue;
  /** Page title displayed in the app bar. */
  title: string;
}

/**
 * Top app bar for the admin shell.
 *
 * Houses the drawer toggle (mobile menu / desktop collapse), the page title,
 * the accessibility controls, the WebSocket status warning, and a notification
 * bell badged with the pending-incident count.
 */
export function AdminHeader({
  expanded,
  onToggleDrawer,
  onOpenMobile,
  pendingIncidents,
  websocketStatus,
  title,
}: AdminHeaderProps) {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        ml: { md: `${SIDEBAR_WIDTH}px` },
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

        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>

        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <AccessibilityControls />
        </Box>

        <WebSocketStatus status={websocketStatus} />

        <Tooltip title="Notifications">
          <IconButton
            aria-label={`Notifications: ${pendingIncidents} pending incidents`}
            color="inherit"
          >
            <Badge
              badgeContent={pendingIncidents}
              color="error"
              overlap="circular"
              max={99}
            >
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
