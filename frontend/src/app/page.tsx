"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Placeholder resident dashboard. Landing target after successful login.
 * Redirects unauthenticated visitors to the login page.
 */
export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (!isLoading && !isAuthenticated) {
    router.replace("/login");
    return null;
  }

  return (
    <Box sx={{ minHeight: "100dvh", p: 4 }}>
      <Paper
        elevation={3}
        sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, maxWidth: 560, mx: "auto" }}
      >
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h4" component="h1">
            KaBarangayConnect
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome{user?.name ? `, ${user.name}` : ""}! You are signed in as a
            resident.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This is a placeholder dashboard. Barangay services and civic
            engagement features are coming soon.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Log out
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
