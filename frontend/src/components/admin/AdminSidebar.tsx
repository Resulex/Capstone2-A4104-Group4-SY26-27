"use client";

import { useEffect, useId, useState } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DashboardIcon from "@mui/icons-material/Dashboard";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupIcon from "@mui/icons-material/Group";
import CampaignIcon from "@mui/icons-material/Campaign";
import BadgeIcon from "@mui/icons-material/Badge";
import ForumIcon from "@mui/icons-material/Forum";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SettingsIcon from "@mui/icons-material/Settings";
import GavelIcon from "@mui/icons-material/Gavel";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import { AdminProfile, getInitials } from "@/hooks/useAdminProfile";
import { canViewNavItem } from "@/lib/rbac";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getShellColors } from "@/theme/theme";

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
  /** Unread incident reports (badge on the Incident Reports nav icon). */
  unreadIncidentsCount?: number;
  /** Unread document requests (badge on the Document Queue nav icon). */
  unreadDocumentsCount?: number;
  /**
   * Live chat sessions still waiting for a reply from ANY staff member — the one
   * shared queue. Not this admin's unread notifications: the badge has to drop
   * for everyone the moment somebody answers.
   */
  unreadChatCount?: number;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

/** A collapsible section of the sidebar. */
interface NavGroup {
  /** Stable key used for the open/closed state map. */
  id: string;
  /** Label rendered on the dropdown row. */
  label: string;
  items: NavItem[];
}

/**
 * Admin navigation, grouped into dropdown sections.
 *
 * A group whose items are all filtered out by RBAC (`canViewNavItem`) is not
 * rendered at all, so a restricted role never sees an empty heading.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Dashboard", icon: <DashboardIcon />, href: "/admin" },
      {
        label: "Document Queue",
        icon: <DescriptionIcon />,
        href: "/admin/document-requests",
      },
      {
        label: "Incident Reports",
        icon: <WarningAmberIcon />,
        href: "/admin/incidents",
      },
      { label: "Live Chat", icon: <ForumIcon />, href: "/admin/chat-sessions" },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      {
        label: "Announcements",
        icon: <CampaignIcon />,
        href: "/admin/announcements",
      },
      {
        label: "Barangay Officials",
        icon: <BadgeIcon />,
        href: "/admin/officials",
      },
      // Hidden for now:
      // { label: "Residents", icon: <PeopleIcon />, href: "/admin/residents" },
      // { label: "Barangays", icon: <MapIcon />, href: "/admin/barangays" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        label: "Notifications",
        icon: <NotificationsIcon />,
        href: "/admin/notifications",
      },
      { label: "Settings", icon: <SettingsIcon />, href: "/admin/settings" },
      {
        label: "Resident List",
        icon: <PeopleIcon />,
        href: "/admin/residents",
      },
      {
        label: "User Management",
        icon: <GroupIcon />,
        href: "/admin/users",
      },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    items: [
      {
        label: "Data Privacy & Terms",
        icon: <GavelIcon />,
        href: "/admin/legal",
      },
    ],
  },
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
  unreadIncidentsCount = 0,
  unreadDocumentsCount = 0,
  unreadChatCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);

  const role = adminProfile?.assignedRole;

  // RBAC first, then drop groups left empty — a role must never see a heading
  // with nothing under it (e.g. Information Officer + Account > User Mgmt).
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canViewNavItem(role, item.href)),
  })).filter((group) => group.items.length > 0);

  const isItemActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // The section that owns the current route. The first render uses it to pick
  // which dropdown starts open; the effect below re-opens it on navigation.
  const activeGroupId = groups.find((group) =>
    group.items.some((item) => isItemActive(item.href)),
  )?.id;

  // Only the section owning the landing URL starts expanded — falling back to
  // the first visible one on routes no nav item owns — so the drawer is not a
  // wall of open dropdowns. Toggles made afterwards are kept as the admin left
  // them (client-side navigation does not remount this component).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NAV_GROUPS.map((group) => [
        group.id,
        group.id === (activeGroupId ?? groups[0]?.id),
      ]),
    ),
  );

  const toggleGroup = (id: string) =>
    setOpenGroups((state) => ({ ...state, [id]: !(state[id] ?? false) }));

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((state) =>
      state[activeGroupId] === false
        ? { ...state, [activeGroupId]: true }
        : state,
    );
  }, [activeGroupId, pathname]);

  const unreadForItem = (href: string) => {
    if (href === "/admin/incidents" && unreadIncidentsCount > 0) {
      return { kind: "count" as const, value: unreadIncidentsCount };
    }
    if (href === "/admin/document-requests" && unreadDocumentsCount > 0) {
      return { kind: "count" as const, value: unreadDocumentsCount };
    }
    if (href === "/admin/chat-sessions" && unreadChatCount > 0) {
      return { kind: "count" as const, value: unreadChatCount };
    }
    return undefined;
  };

  /** Unread total for a section, surfaced on its header while collapsed. */
  const unreadForGroup = (items: NavItem[]) =>
    items.reduce(
      (total, item) => total + (unreadForItem(item.href)?.value ?? 0),
      0,
    );

  const navList = (
    <List
      component="nav"
      aria-label="Admin navigation"
      sx={{ px: 1, py: 1, flexGrow: 1, overflowY: "auto" }}
    >
      {expanded
        ? groups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              label={group.label}
              open={openGroups[group.id] ?? false}
              onToggle={() => toggleGroup(group.id)}
              badgeCount={unreadForGroup(group.items)}
            >
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  active={isItemActive(item.href)}
                  expanded
                  badge={unreadForItem(item.href)}
                  nested
                  onNavigate={onMobileClose}
                />
              ))}
            </SidebarNavGroup>
          ))
        : // Collapsed (mini-variant) drawer: there is no room for section
          // headers, so the same items render as a flat icon rail.
          groups
            .flatMap((group) => group.items)
            .map((item) => (
              <SidebarNavItem
                key={item.label}
                item={item}
                active={isItemActive(item.href)}
                expanded={false}
                badge={unreadForItem(item.href)}
              />
            ))}
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
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 700, color: shell.sidebarText }}
                >
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
            bgcolor: shell.sidebar,
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
            bgcolor: shell.sidebar,
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
  // Shares the app bar's surface color so the brand band and the header read
  // as one continuous band across the top of the shell.
  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: expanded ? "flex-start" : "center",
        gap: 1.5,
        px: expanded ? 2 : 0,
        minHeight: 64,
        bgcolor: shell.header,
        borderBottom: 1,
        borderColor: "divider",
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

/**
 * Collapsible sidebar section.
 *
 * The header is a real button exposing `aria-expanded` / `aria-controls` for
 * keyboard and screen-reader users; the rows live inside a `Collapse`. While a
 * section is closed its unread total is lifted onto the header, so collapsing
 * a section can never hide a waiting count.
 */
function SidebarNavGroup({
  label,
  open,
  onToggle,
  badgeCount = 0,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  badgeCount?: number;
  children: React.ReactNode;
}) {
  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);
  const contentId = useId();

  return (
    <Box>
      <ListItemButton
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${label} section`}
        sx={{ minHeight: 40, px: 2.5, mb: 0.5, borderRadius: 2 }}
      >
        <Typography
          variant="overline"
          sx={{
            flexGrow: 1,
            color: shell.sidebarText,
            fontWeight: 700,
            lineHeight: 1.8,
          }}
        >
          {label}
        </Typography>
        {!open && badgeCount > 0 && (
          <Chip
            size="small"
            color="error"
            label={badgeCount > 9 ? "9+" : badgeCount}
            sx={{ mr: 1, height: 20, fontSize: 11, fontWeight: 700 }}
          />
        )}
        {open ? (
          <ExpandLessIcon sx={{ fontSize: 20, color: "text.secondary" }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 20, color: "text.secondary" }} />
        )}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit id={contentId}>
        <List disablePadding>{children}</List>
      </Collapse>
    </Box>
  );
}

/** A single sidebar row: icon, label, active styling and unread indicator. */
function SidebarNavItem({
  item,
  active,
  expanded,
  badge,
  nested = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  badge?: { kind: "count"; value: number } | { kind: "dot" };
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);

  const icon =
    badge?.kind === "count" && badge.value > 0 ? (
      <Badge badgeContent={badge.value} color="error" overlap="circular" max={9}>
        {item.icon}
      </Badge>
    ) : badge?.kind === "dot" ? (
      <Badge color="error" variant="dot" overlap="circular">
        {item.icon}
      </Badge>
    ) : (
      item.icon
    );

  return (
    <ListItem disablePadding sx={{ mb: 0.5 }}>
      <Tooltip
        title={expanded ? "" : item.label}
        placement="right"
        disableHoverListener={expanded}
      >
        <ListItemButton
          component={Link}
          href={item.href}
          selected={active}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          sx={{
            minHeight: 48,
            justifyContent: expanded ? "initial" : "center",
            px: expanded && nested ? 3 : 2.5,
            borderRadius: 2,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: expanded ? 2 : "auto",
              justifyContent: "center",
              color: active ? "primary.main" : "text.secondary",
            }}
          >
            {icon}
          </ListItemIcon>
          {expanded && (
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                sx: { color: active ? "primary.main" : shell.sidebarText },
              }}
            />
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
}
