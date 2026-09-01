"use client";

import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardIcon from "@mui/icons-material/Dashboard";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupIcon from "@mui/icons-material/Group";
import CampaignIcon from "@mui/icons-material/Campaign";
import PeopleIcon from "@mui/icons-material/People";
import BadgeIcon from "@mui/icons-material/Badge";
import MapIcon from "@mui/icons-material/Map";
import ForumIcon from "@mui/icons-material/Forum";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { AdminProfile, getInitials } from "@/hooks/useAdminProfile";

/** Width of the expanded (persistent) drawer. */
export const SIDEBAR_WIDTH = 240;
/** Width of the collapsed (mini-variant) drawer. */
export const SIDEBAR_WIDTH_COLLAPSED = 72;

interface AdminSidebarProps {
  /** Whether the desktop drawer is expanded (shows labels). */
  expanded: boolean;
  /** Whether the mobile (temporary) drawer is open. */
  mobileOpen: boolean;
  /** Close the mobile drawer. */
  onMobileClose: () => void;
  /** Signed-in administrator profile (may be null). */
  adminProfile: AdminProfile | null;
  /** Sign out handler. */
  onLogout: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: <DashboardIcon />, href: "/admin" },
  { label: "Incident Reports", icon: <WarningAmberIcon />, href: "/admin/incidents" },
  {
    label: "Document Queue",
    icon: <DescriptionIcon />,
    href: "/admin/document-requests",
  },
  { label: "Announcements", icon: <CampaignIcon />, href: "/admin/announcements" },
//   { label: "Users", icon: <GroupIcon />, href: "/admin/users" },
  { label: "Barangay Officials", icon: <BadgeIcon />, href: "/admin/officials" },
//   { label: "Residents", icon: <PeopleIcon />, href: "/admin/residents" },
//   { label: "Barangays", icon: <MapIcon />, href: "/admin/barangays" },
  { label: "Live Chat", icon: <ForumIcon />, href: "/admin/chat-sessions" },
  {
    label: "Notifications",
    icon: <NotificationsIcon />,
    href: "/admin/notifications",
  },
  { label: "Settings", icon: <SettingsIcon />, href: "/admin/settings" },
];

/**
 * Admin navigation drawer.
 *
 * Renders a persistent mini-variant drawer on desktop (labels shown when
 * `expanded`, icons-only when collapsed) and a temporary drawer on mobile.
 * The bottom holds the admin profile section and the Logout control.
 */
export function AdminSidebar({
  expanded,
  mobileOpen,
  onMobileClose,
  adminProfile,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const navList = (
    <List component="nav" aria-label="Admin navigation" sx={{ px: 1, py: 1 }}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin"
          ? pathname === "/admin"
          : pathname.startsWith(item.href);
        return (
          <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip
              title={expanded ? "" : item.label}
              placement="right"
              disableHoverListener={expanded}
            >
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                aria-current={isActive ? "page" : undefined}
                sx={{
                  minHeight: 48,
                  justifyContent: expanded ? "initial" : "center",
                  px: 2.5,
                  borderRadius: 2,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: expanded ? 2 : "auto",
                    justifyContent: "center",
                    color: isActive ? "primary.main" : "text.secondary",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {expanded && <ListItemText primary={item.label} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      })}
    </List>
  );

  const profileSection = (
    <Box sx={{ mt: "auto", px: 1, pb: 1 }}>
      <Divider sx={{ mb: 1 }} />
      <List aria-label="Account" disablePadding>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 1.5,
              py: 1,
              width: "100%",
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {getInitials(adminProfile)}
            </Avatar>
            {expanded && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                  {adminProfile?.firstName && adminProfile?.lastName
                    ? `${adminProfile.firstName} ${adminProfile.lastName}`
                    : adminProfile?.emailAddress ?? "Administrator"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {adminProfile?.assignedRole ?? "Admin"}
                </Typography>
              </Box>
            )}
          </Box>
        </ListItem>
        <ListItem disablePadding>
          <Tooltip
            title={expanded ? "" : "Log out"}
            placement="right"
            disableHoverListener={expanded}
          >
            <ListItemButton
              onClick={onLogout}
              aria-label="Log out"
              sx={{
                minHeight: 48,
                justifyContent: expanded ? "initial" : "center",
                px: 2.5,
                borderRadius: 2,
                color: "text.secondary",
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: expanded ? 2 : "auto",
                  justifyContent: "center",
                  color: "text.secondary",
                }}
              >
                <LogoutIcon />
              </ListItemIcon>
              {expanded && <ListItemText primary="Log out" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      {/* Desktop: persistent mini-variant drawer. */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: expanded ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_COLLAPSED,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: expanded ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_COLLAPSED,
            boxSizing: "border-box",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            transition: (theme) =>
              theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            borderRight: 1,
            borderColor: "divider",
          },
        }}
      >
        <DrawerBrand expanded={expanded} />
        {navList}
        {profileSection}
      </Drawer>

      {/* Mobile: temporary drawer. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <DrawerBrand expanded />
        {navList}
        {profileSection}
      </Drawer>
    </>
  );
}

/** Brand header shown at the top of the drawer. */
function DrawerBrand({ expanded }: { expanded: boolean }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: expanded ? "flex-start" : "center",
        gap: 1.5,
        px: expanded ? 2 : 0,
        minHeight: 64,
      }}
    >
      <Box sx={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
        <Image
          src="/images/KaBarangay-logo.png"
          alt="KaBarangayConnect logo"
          fill
          style={{ objectFit: "contain" }}
          sizes="50px"
        />
      </Box>
      {expanded && (
        <Box component="span" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          Admin
        </Box>
      )}
    </Box>
  );
}
