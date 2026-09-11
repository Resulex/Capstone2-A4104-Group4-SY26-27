"use client";

import { useEffect, useId, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
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
import DescriptionIcon from "@mui/icons-material/Description";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CampaignIcon from "@mui/icons-material/Campaign";
import BadgeIcon from "@mui/icons-material/Badge";
import ForumIcon from "@mui/icons-material/Forum";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import GavelIcon from "@mui/icons-material/Gavel";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import { ResidentProfile, getResidentInitials } from "@/lib/resident";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getShellColors } from "@/theme/theme";

/** Width of the resident navigation drawer. */
export const RESIDENT_SIDEBAR_WIDTH = 280;
/** Width of the collapsed (mini-variant) desktop drawer. */
export const RESIDENT_SIDEBAR_WIDTH_COLLAPSED = 72;

interface ResidentSidebarProps {
  /** Whether the desktop drawer is expanded (shows labels). */
  expanded: boolean;
  /** Whether the mobile (temporary) drawer is open. */
  mobileOpen: boolean;
  /** Close the mobile drawer. */
  onMobileClose: () => void;
  /** Signed-in resident profile (may be null). */
  residentProfile: ResidentProfile | null;
  /** Sign out handler. */
  onLogout: () => void;
  /** When true, only the "Data Privacy & Terms of Service" item is shown. */
  legalOnly?: boolean;
  /** Number of unread chat messages/notifications (red dot on Live Chat). */
  chatUnread?: number;
  /** Number of unread notifications of any kind (count badge on Notifications). */
  notificationsUnread?: number;
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

/** Resident navigation — mirrors the app's drawer menu, grouped into sections. */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "services",
    label: "Services",
    items: [
      { label: "Dashboard", icon: <DashboardIcon />, href: "/" },
      {
        label: "My Document Requests",
        icon: <DescriptionIcon />,
        href: "/documents",
      },
      {
        label: "My Incident Reports",
        icon: <WarningAmberIcon />,
        href: "/incidents",
      },
      { label: "Live Chat", icon: <ForumIcon />, href: "/chat" },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      {
        label: "Announcements",
        icon: <CampaignIcon />,
        href: "/announcements",
      },
      { label: "Barangay Officials", icon: <BadgeIcon />, href: "/officials" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        label: "Notifications",
        icon: <NotificationsIcon />,
        href: "/notifications",
      },
      {
        label: "Display & Accessibility",
        icon: <AccessibilityNewIcon />,
        href: "/settings",
      },
      // Support is grouped with the account items rather than under Legal:
      // help content is not legal copy, and Legal reads cleaner with one entry.
      {
        label: "Help & Support Center",
        icon: <SupportAgentIcon />,
        href: "/help",
      },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    items: [
      { label: "Data Privacy & Terms", icon: <GavelIcon />, href: "/legal" },
    ],
  },
];

/**
 * Resident navigation drawer (the hamburger menu).
 *
 * Renders a persistent mini-variant drawer on desktop (labels when `expanded`,
 * icons-only when collapsed) and a temporary drawer on mobile. The profile
 * header sits at the top (per the Figma menu) and the Logout control is pinned
 * to the bottom.
 */
export function ResidentSidebar({
  expanded,
  mobileOpen,
  onMobileClose,
  residentProfile,
  onLogout,
  legalOnly = false,
  chatUnread = 0,
  notificationsUnread = 0,
}: ResidentSidebarProps) {
  const pathname = usePathname();

  const { highContrast } = useAccessibilityTheme();
  const shell = getShellColors(highContrast);

  // Before consent is recorded, the only allowed destination is the Terms page.
  // That gate renders a flat single-item list: there is nothing to group, and a
  // collapsible section would let the resident hide their only way forward.
  const groups = (
    legalOnly
      ? NAV_GROUPS.map((group) => ({
          ...group,
          items: group.items.filter((item) => item.href === "/legal"),
        }))
      : NAV_GROUPS
  ).filter((group) => group.items.length > 0);

  const showGroupHeaders = expanded && !legalOnly;

  const isItemActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // The section that owns the current route. The first render uses it to pick
  // which dropdown starts open; the effect below re-opens it on navigation.
  const activeGroupId = groups.find((group) =>
    group.items.some((item) => isItemActive(item.href)),
  )?.id;

  // Only the section owning the landing URL starts expanded — falling back to
  // the first visible one on routes no nav item owns — so the drawer is not a
  // wall of open dropdowns. Toggles made afterwards are kept as the resident
  // left them (client-side navigation does not remount this component).
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

  const badgeFor = (href: string) => {
    if (href === "/notifications" && notificationsUnread > 0) {
      return { kind: "count" as const, value: notificationsUnread };
    }
    return href === "/chat" && chatUnread > 0
      ? { kind: "dot" as const }
      : undefined;
  };

  const navList = (
    <List
      component="nav"
      aria-label="Resident navigation"
      sx={{ px: 1, py: 1, flexGrow: 1, overflowY: "auto" }}
    >
      {showGroupHeaders
        ? groups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              label={group.label}
              open={openGroups[group.id] ?? false}
              onToggle={() => toggleGroup(group.id)}
            >
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  active={isItemActive(item.href)}
                  expanded
                  badge={badgeFor(item.href)}
                  nested
                  onNavigate={onMobileClose}
                />
              ))}
            </SidebarNavGroup>
          ))
        : // Collapsed (mini-variant) drawer — and the pre-consent legal gate —
          // have no room for/need of section headers, so items render flat.
          groups
            .flatMap((group) => group.items)
            .map((item) => (
              <SidebarNavItem
                key={item.label}
                item={item}
                active={isItemActive(item.href)}
                expanded={expanded}
                badge={badgeFor(item.href)}
                onNavigate={onMobileClose}
              />
            ))}
    </List>
  );

  const profileHeader = (
    <Box
      sx={{
        px: 2,
        py: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Avatar
        src={residentProfile?.profileImageUrl}
        imgProps={{ "aria-label": "Profile picture" }}
        sx={{
          width: 48,
          height: 48,
          bgcolor: "primary.main",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {getResidentInitials(residentProfile)}
      </Avatar>
      {expanded && (
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="body1"
            noWrap
            sx={{ fontWeight: 700, color: shell.sidebarText }}
          >
            {residentProfile
              ? `${residentProfile.firstName ?? ""} ${residentProfile.lastName ?? ""}`.trim() ||
                "Resident"
              : "Resident"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {residentProfile?.emailAddress ?? "Signing in…"}
          </Typography>
          {/* <Chip
            icon={<CheckCircleIcon />}
            label="Account: Verified"
            size="small"
            color="success"
            variant="outlined"
            sx={{ mt: 0.5, fontWeight: 600 }}
          /> */}
        </Box>
      )}
      {/* Close affordance shown on the temporary (mobile) drawer. */}
      <IconButton
        onClick={onMobileClose}
        aria-label="Close navigation menu"
        sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto" }}
      >
        <CloseIcon />
      </IconButton>
    </Box>
  );

  const logoutItem = (
    <Box sx={{ mt: "auto", px: 1, pb: 1 }}>
      <Divider sx={{ borderStyle: "dashed", my: 1, borderColor: "divider" }} />
      <Tooltip
        title={expanded ? "" : "Logout"}
        placement="right"
        disableHoverListener={expanded}
      >
        <ListItemButton
          onClick={onLogout}
          aria-label="Logout"
          sx={{
            minHeight: 48,
            justifyContent: expanded ? "initial" : "center",
            px: 2,
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
          {expanded && <ListItemText primary="Logout" />}
        </ListItemButton>
      </Tooltip>
    </Box>
  );

  const drawerBrand = (
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
          KaBarangayConnect
        </Box>
      )}
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
          width: expanded ? RESIDENT_SIDEBAR_WIDTH : RESIDENT_SIDEBAR_WIDTH_COLLAPSED,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: expanded
              ? RESIDENT_SIDEBAR_WIDTH
              : RESIDENT_SIDEBAR_WIDTH_COLLAPSED,
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
        {drawerBrand}
        {profileHeader}
        {navList}
        {logoutItem}
      </Drawer>

      {/* Mobile: temporary drawer (hamburger menu). */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: RESIDENT_SIDEBAR_WIDTH,
            boxSizing: "border-box",
            bgcolor: shell.sidebar,
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {drawerBrand}
        {profileHeader}
        {navList}
        {logoutItem}
      </Drawer>
    </>
  );
}

/**
 * Collapsible sidebar section.
 *
 * The header is a real button exposing `aria-expanded` / `aria-controls` for
 * keyboard and screen-reader users; the rows live inside a `Collapse`.
 */
function SidebarNavGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
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
