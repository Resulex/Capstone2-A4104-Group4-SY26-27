"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import { ResidentProfile, getResidentInitials } from "@/lib/resident";

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
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

/** Resident navigation — mirrors the app's drawer menu items. */
const NAV_ITEMS: NavItem[] = [
  { label: "Home / Dashboard", icon: <DashboardIcon />, href: "/" },
  { label: "My Document Requests", icon: <DescriptionIcon />, href: "/documents" },
  { label: "My Incident Reports", icon: <WarningAmberIcon />, href: "/incidents" },
  { label: "Live Chat", icon: <ForumIcon />, href: "/chat" },
  { label: "Announcements", icon: <CampaignIcon />, href: "/announcements" },
  { label: "Barangay Officials", icon: <BadgeIcon />, href: "/officials" },
  { label: "Notifications", icon: <NotificationsIcon />, href: "/notifications" },
  { label: "Help & Support Center", icon: <SupportAgentIcon />, href: "/help" },
  {
    label: "Data Privacy & Terms of Service",
    icon: <GavelIcon />,
    href: "/legal",
  },
  {
    label: "Display & Accessibility Settings",
    icon: <AccessibilityNewIcon />,
    href: "/settings",
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
}: ResidentSidebarProps) {
  const pathname = usePathname();

  const navList = (
    <List component="nav" aria-label="Resident navigation" sx={{ px: 1, py: 1 }}>
      {NAV_ITEMS.map((item, index) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Box key={item.label}>
            {index > 0 && (
              <Divider
                sx={{ borderStyle: "dashed", my: 0.5, borderColor: "divider" }}
              />
            )}
            <ListItem disablePadding sx={{ mb: 0.5 }}>
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
                    px: 2,
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
          </Box>
        );
      })}
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
          <Typography variant="body1" noWrap sx={{ fontWeight: 700 }}>
            {residentProfile
              ? `${residentProfile.firstName ?? ""} ${residentProfile.lastName ?? ""}`.trim() ||
                "Resident"
              : "Resident"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {residentProfile?.emailAddress ?? "Signing in…"}
          </Typography>
          <Chip
            icon={<CheckCircleIcon />}
            label="Account: Verified"
            size="small"
            color="success"
            variant="outlined"
            sx={{ mt: 0.5, fontWeight: 600 }}
          />
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
