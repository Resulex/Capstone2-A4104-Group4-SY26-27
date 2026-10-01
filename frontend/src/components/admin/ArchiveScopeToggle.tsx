"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ArchiveScope } from "@/lib/admin";
import { useCanArchive } from "@/hooks/useCanArchive";

interface ArchiveScopeToggleProps {
  scope: ArchiveScope;
  onChange: (scope: ArchiveScope) => void;
  /** Noun for the accessible label, e.g. "incident reports". */
  label: string;
  disabled?: boolean;
}

/**
 * Active / Archived switch for a record queue.
 *
 * Renders NOTHING unless the signed-in administrator is a SUPER_ADMIN. Archiving
 * and restoring are records-governance actions, and the backend enforces the same
 * rule with a 403 on the archived scope — hiding the control is what stops the
 * other roles from reaching a switch whose only possible answer is a refusal.
 *
 * Fail closed: while the profile is still resolving the role is unknown, so the
 * control stays hidden rather than flashing and then disappearing.
 */
export function ArchiveScopeToggle({
  scope,
  onChange,
  label,
  disabled = false,
}: ArchiveScopeToggleProps) {
  const { canArchive, isLoading } = useCanArchive();

  if (isLoading || !canArchive) return null;

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={scope}
      onChange={(_event, next: ArchiveScope | null) => {
        // MUI reports null when the active button is clicked again. Ignoring it
        // keeps a scope selected instead of leaving the page showing nothing.
        if (next) onChange(next);
      }}
      aria-label={`Show active or archived ${label}`}
    >
      <ToggleButton
        value="active"
        disabled={disabled}
        sx={{ textTransform: "none", px: 1.5 }}
      >
        Active
      </ToggleButton>
      <ToggleButton
        value="archived"
        disabled={disabled}
        sx={{ textTransform: "none", px: 1.5 }}
      >
        Archived
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
