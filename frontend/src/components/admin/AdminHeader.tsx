"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Popover from "@mui/material/Popover";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Button from "@mui/material/Button";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { WebSocketStatus } from "@/components/admin/WebSocketStatus";
import { SIDEBAR_WIDTH } from "@/components/admin/AdminSidebar";
import { NotificationRecord } from "@/lib/admin";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getShellColors } from "@/theme/theme";

interface AdminHeaderProps {
  /** Whether the desktop drawer is expanded. */
  expanded: boolean;
  /** Toggle the desktop drawer's collapsed/expanded state. */
  onToggleDrawer: () => void;
  /** Open the mobile drawer. */
  onOpenMobile: () => void;
  /** Number of pending incidents (shown as the notification badge). */
  pendingIncidents: number;
  /** The admin's notifications, newest first. */
  notifications: NotificationRecord[];
  /** Count of unread notifications (badge, capped at 9+). */
  unreadCount: number;
  /** Mark a single notification as read. */
  onMarkRead: (id: string) => void;
  /** Mark all notifications as read. */
  onMarkAllRead: () => void;
  /** True when the browser is online AND the WebSocket is connected. */
  online: boolean;
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
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  online,
  title,
}: AdminHeaderProps) {
  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);
  const [bellAnchor, setBellAnchor] = useState<HTMLElement | null>(null);
  const unread = notifications.filter((n) => !n.isRead);

  const handleOpenBell = (event: React.MouseEvent<HTMLElement>) =>
    setBellAnchor(event.currentTarget);
  const handleCloseBell = () => setBellAnchor(null);

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
        bgcolor: shell.header,
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
          sx={{ flexGrow: 1, color: shell.headerText }}
        >
          {title}
        </Typography>

        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <AccessibilityControls />
        </Box>

        <WebSocketStatus isOnline={online} />

        <Tooltip title="Notifications">
          <IconButton
            aria-label={`Notifications: ${unreadCount} unread`}
            color="inherit"
            onClick={handleOpenBell}
          >
            <Badge
              badgeContent={unreadCount}
              color="error"
              overlap="circular"
              max={9}
            >
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Popover
          open={Boolean(bellAnchor)}
          anchorEl={bellAnchor}
          onClose={handleCloseBell}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ width: 340, p: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Notifications
              </Typography>
              {unread.length > 0 && (
                <Button size="small" onClick={onMarkAllRead}>
                  Read all
                </Button>
              )}
            </Box>

            {unread.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                You&apos;re all caught up.
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 320, overflowY: "auto" }}>
                {unread.map((n) => (
                  <ListItem key={n.notificationId} disablePadding>
                    <ListItemButton
                      onClick={() => onMarkRead(n.notificationId)}
                      sx={{ borderRadius: 1, bgcolor: "action.hover" }}
                    >
                      <ListItemText
                        primary={n.titleText}
                        secondary={n.messageBody}
                        primaryTypographyProps={{ fontWeight: 700 }}
                        secondaryTypographyProps={{
                          variant: "body2",
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Popover>
      </Toolbar>
    </AppBar>
  );
}
