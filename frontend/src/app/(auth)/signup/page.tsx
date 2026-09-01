"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { PrivacyGate } from "@/components/signup/PrivacyGate";
import {
  BasicInfoStep,
  type BasicInfoValues,
} from "@/components/signup/BasicInfoStep";
import {
  AddressStep,
  type AddressValues,
} from "@/components/signup/AddressStep";
import { StepHeader } from "@/components/signup/StepHeader";
import { ApiError } from "@/lib/api";
import {
  fetchSignupBarangay,
  registerResident,
  type SignupBarangay,
  type SignupPayload,
} from "@/lib/signup";

const SIGNUP_CONSENT_KEY = "kbc_signup_consent";

type Step = "consent" | "basic" | "address";

/**
 * Resident sign-up (`/signup`).
 *
 * Flow: Data Privacy & Agreements gate (must agree) → Step 1 Basic Information
 * → Step 2 Residential Address (auto-filled, read-only from the registration
 * system) → confirm → POST /auth/register → redirect to /login with a success
 * toast.
 */
export default function ResidentSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("consent");
  const [basicValues, setBasicValues] = useState<BasicInfoValues | null>(null);
  const [barangay, setBarangay] = useState<SignupBarangay | null>(null);
  const [loadingBarangay, setLoadingBarangay] = useState(true);
  const [barangayError, setBarangayError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Skip the privacy gate if consent was already recorded, and prefetch the
  // registration-system barangay that auto-fills the address step.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const accepted =
          window.localStorage.getItem(SIGNUP_CONSENT_KEY) === "true";
        if (!cancelled && accepted) setStep("basic");
      } catch {
        // ignore
      }

      try {
        const list = await fetchSignupBarangay();
        if (!cancelled && list && list.length > 0) setBarangay(list[0]);
        if (!cancelled && (!list || list.length === 0)) {
          setBarangayError(
            "No barangay registration data is available yet. Please try again later.",
          );
        }
      } catch (err) {
        if (!cancelled) {
          setBarangayError(
            err instanceof ApiError
              ? err.message
              : "Could not load registration data. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoadingBarangay(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConsentAgree = useCallback(() => {
    try {
      window.localStorage.setItem(SIGNUP_CONSENT_KEY, "true");
    } catch {
      // ignore
    }
    setStep("basic");
  }, []);

  const handleBasicSubmit = useCallback((values: BasicInfoValues) => {
    setBasicValues(values);
    setStep("address");
  }, []);

  const handleAddressSubmit = useCallback(
    async (values: AddressValues) => {
      if (!basicValues || !barangay) return;
      setSubmitting(true);
      setSubmitError(null);

      const payload: SignupPayload = {
        firstName: basicValues.firstName,
        lastName: basicValues.lastName,
        middleName: basicValues.middleName.trim() || undefined,
        suffix: basicValues.suffix.trim() || undefined,
        email: basicValues.email,
        contactNumber: basicValues.contactNumber,
        password: basicValues.password,
        barangayId: barangay._id,
        houseUnitNumber: values.houseUnitNumber,
        streetPurokName: values.streetPurokName,
      };

      try {
        await registerResident(payload);
        router.push("/login?registered=1");
      } catch (err) {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : "Could not create your account. Please try again.",
        );
        setSubmitting(false);
      }
    },
    [basicValues, barangay, router],
  );

  return (
    <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
      {step === "consent" ? (
        <PrivacyGate onAgree={handleConsentAgree} />
      ) : (
        <>
          <StepHeader
            step={step === "basic" ? 1 : 2}
            heading={
              step === "basic" ? "Basic Information" : "Confirm Address"
            }
          />
          <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            {submitError && (
              <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}

            {step === "basic" ? (
              <BasicInfoStep onSubmit={handleBasicSubmit} />
            ) : (
              <AddressStep
                barangay={barangay}
                loading={loadingBarangay}
                error={barangayError}
                submitting={submitting}
                onSubmit={handleAddressSubmit}
              />
            )}

            <Typography
              component="span"
              variant="body2"
              align="center"
              color="text.secondary"
              sx={{ display: "block", mt: 3 }}
            >
              Already have an account?{" "}
              <Link href="/login">
                <Typography
                  component="span"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  Log in
                </Typography>
              </Link>
            </Typography>
          </Box>
        </>
      )}
    </Paper>
  );
}
