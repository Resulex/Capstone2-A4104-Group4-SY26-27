"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SecurityIcon from "@mui/icons-material/Security";
import { useAuth } from "@/context/AuthContext";

/**
 * Admin Dashboard (placeholder).
 *
 * This is the completion target of the admin login flow. It is a minimal
 * guarded page for now; the real dashboard will be built separately.
 */
export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/admin/login");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, maxWidth: 520 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <SecurityIcon color="primary" sx={{ fontSize: 56 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome{user?.name ? `, ${user.name}` : ""}. You are signed in as an
            administrator.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The administrative dashboard is under construction.
          </Typography>
          <Button variant="outlined" color="inherit" onClick={handleLogout}>
            Sign Out
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
