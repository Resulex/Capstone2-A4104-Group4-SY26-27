# Setting up AWS Cognito for Admin Login (AWS Console / GUI walkthrough)

This guide creates the **Cognito User Pool** + **app client** that the admin
login flow uses (hybrid auth: Cognito verifies password + **software-token MFA
(TOTP / Google Authenticator)**, then the app issues its own session JWT).

> No SMS/SNS setup is needed — we use TOTP (authenticator app), so there is no
> SMS sandbox, no phone number verification, and no per-message cost.

---

## 0. Prerequisites

- You can sign in to the **AWS Console** in the same region your backend uses
  (default `ap-southeast-1`). Pick the region **top-right** first and keep it
  consistent for steps below.
- Your backend code is deployed with Serverless (`sls deploy`) — the Lambda
  role already includes the `cognito-idp` permissions, and the new login
  endpoints are registered. You only manage the pool/app client here.
- The **Admin email** in Cognito must exactly match a Mongo `Admin`
  `emailAddress` (that is how login maps the Cognito user to the admin).

---

## 1. Create the User Pool

1. Open the **Cognito** console: Services → search `Cognito`.
2. Click **User Pools** → **Create user pool**.
3. **Step 1 – Configure sign-in experience**
   - Under *Who can sign in?* choose **User name** and make sure the checkbox
     **Email** (allow email as a sign-in name) is checked → username = email.
     (You can keep "User name" unchecked so email is the username.)
   - Under *User account recovery* pick any option; if email is the username,
     recovery will rely on the verified email — leave the defaults.
   - Click **Next**.
4. **Step 2 – Configure security requirements**
   - **Multi-factor authentication (MFA)**: choose **Enforced (required)** —
     this is what makes every admin set up TOTP on first login.
   - Under *Which second factors* select ONLY **Time-based one-time password
     (TOTP)** — NOT SMS.
   - **User sign-ups**: set **Self-service sign-up** to **Off** (admins are
     created by the backend, not self-registered).
   - Leave the password policy defaults (our code creates passwords that meet
     them). Click **Next**.
5. **Step 3 – Configure message delivery**
   - Keep the defaults. At this point the pool's **default Cognito sender** is
     only used by `npm run provision:cognito` (bulk CLI provisioning), which
     relies on Cognito's **account invitation** message. It sends from
     `no-reply@verificationemail.com` and is capped at **50 emails per day**, so
     those invitations can land in spam.
   - Confirm the **Invitation message** template still contains the `{####}`
     placeholder (Message templates → Invitation message). Cognito substitutes
     the temporary password there and *silently skips delivery* if the
     placeholder is missing.
   - **`POST /admins` does not use Cognito mail.** It suppresses Cognito's
     invitation and emails the temporary password itself through Amazon SES, and
     password-reset mail goes out the same way — see *Admin email* below. No
     Cognito template affects either.
6. **Step 4 – Add app clients** (this can also be done later — see §2)
   - Create a new client (see §2) or continue and add it after. Click **Next**.
7. **Step 5 – Set up integrations / attributes**
   - **Email** is required. You do NOT need `phone_number`.
   - Click **Next**, review, and click **Create user pool**.
### Admin email (Amazon SES, not Cognito)

The backend sends its own admin email through Amazon SES, so the copy lives in
the repo (`backend/src/shared/email.ts`) and no Cognito *Message template*
affects it — **no `{####}` placeholder or template edit is required** for these:

- **Account invitation** (`POST /admins`) — the temporary password, sent by
  `sendAdminInviteEmail`. The user is still created in FORCE_CHANGE_PASSWORD, so
  the first sign-in is forced through the "choose a new password" step regardless
  of the email. Cognito's own invitation is suppressed **only when SES is
  configured**; if our send fails, the handler falls back to Cognito's
  invitation (`resendInvite`) so a broken SES setup can never leave a new admin
  with no credentials. The response's `inviteDelivery` field reports which path
  was used (`ses` | `cognito` | `failed`).
- **Password reset** (`POST /auth/admin/forgot-password`) — the single-use reset
  link, sent by `sendPasswordResetEmail`. Cognito's `ForgotPassword` flow is not
  used for admins at all.

`npm run provision:cognito` is the one exception: it still lets Cognito send its
invitation message.

Configure it in `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `SES_FROM_ADDRESS` | Verified SES identity the mail comes from, e.g. `alexmotorph.noreply@gmail.com`. Must match the verified identity **exactly**, in `SES_REGION`. |
| `SES_REGION` | Region the identity is verified in — must match where the functions run (`ap-southeast-1`). |
| `APP_BASE_URL` | Frontend origin used to build the reset link, e.g. `https://<your-app>.amplifyapp.com`. Defaults to `http://localhost:8000`. |

Two things that make sends fail quietly:

- **SES identities are regional.** An identity verified in `us-east-1` cannot be
  used by a function running in `ap-southeast-1`.
- **Sandbox mode only delivers to verified addresses.** Until you request
  production access, mail reaches only the identities you verified — every other
  admin gets nothing, while the API still returns its generic success.

The IAM principal doing the sending needs `ses:SendEmail`: the Lambda role gets
it from `serverless.yml`, and **your own AWS credentials need it too** to test
through `serverless-offline`.

If a send fails, the reason appears in the function log as
`[admin-forgot] SES send to <email> failed (from <address>): …`. The reset link
itself is always logged on the line above, so the flow stays testable locally.


✅ Copy the **User Pool ID** (top of the pool's *Overview*, e.g.
`ap-southeast-1_AbCdEfGhI`) — you'll put it in `.env` in §4.

---

## 2. Create the app client

1. Inside your pool, open **App integration** → **App clients and analytics**.
2. Click **Create app client**.
3. App client name: `kabarangayconnect-backend-admin`.
4. **Client secret**: uncheck / do **NOT generate a client secret** (our Lambda
   uses the admin API, which needs only the client id).
5. Expand **App client authentication flow settings** (or *Authentication
   flows* on some console versions) and enable:
   - ✅ **ALLOW_ADMIN_USER_PASSWORD_AUTH** (username-password for admin APIs)
   - ✅ **ALLOW_REFRESH_TOKEN_AUTH**
   - (You can leave SRP / other flows off.)
6. Click **Create app client**.

✅ Copy the **Client ID** shown (e.g. `1abcdefg234567...`).

---

## 3. (Optional but recommended) Create the admin users

Every Cognito user must exist in the pool AND as a Mongo `Admin` with the same
email. Two ways:

**Option A – CLI provisioning script (recommended):**
```bash
cd backend
# Make sure COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID are in .env, then:
COGNITO_PROVISION_PASSWORD='YourInitialPass!1' npm run provision:cognito
```
This creates pool users for your active Mongo admins with a **permanent**
password and stores `cognitoSub` on each `Admin` record.

**Option B – AWS Console (GUI):**
1. In your pool → **Users** → **Create user**.
2. **Username**: the admin's **email** (must match Mongo exactly).
3. Enter a **temporary password** and leave **"Users must create a new password
   on first sign-in" CHECKED** to mirror what `POST /admins` does — the admin
   signs in with it and the app walks them through choosing their own password
   (`POST /auth/admin/login/new-password`). Unchecking it sets the password as
   permanent and skips that step.
4. Create. Repeat for each admin.
   - Note: console-created users won't have `cognitoSub` stored in Mongo until
     their first successful login (the MFA step writes it automatically), so
     running the provisioning script once is still the cleaner path.

> New admins created later via `POST /admins` in the app are provisioned
> automatically: the backend generates the `ADM-…` id and a temporary password,
> and Cognito emails the invitation. You only need this section for
> existing/seed admins.

---

## 4. Point the backend at the pool

Edit `backend/.env` (gitignored) and add:
```dotenv
COGNITO_USER_POOL_ID=ap-southeast-1_AbCdEfGhI
COGNITO_CLIENT_ID=1abcdefg234567...
COGNITO_REGION=ap-southeast-1
COGNITO_OFFLINE=false
```
Then (re)deploy so the functions receive the values and the new TOTP
endpoints are live:
```bash
cd backend
npm run deploy        # or: npx serverless deploy
```

---

## 5. Test

- **New staff account:** creating a staff account (Admin → Settings → User
  Management) generates the `ADM-…` id and emails a temporary password. The
  admin signs in at `/admin/login` with it, is asked to **set a new password**,
  then continues with the QR enrollment below.
- **First login (enrollment):** sign in at `/admin/login` → password step →
  you are prompted with a **QR code** → scan it with Google Authenticator (or
  Authy) → enter the 6-digit code → sign in again with a code → dashboard.
- **Subsequent logins:** email + password → 6-digit code → dashboard.
- **Wrong code** → `401 Invalid or expired verification code`.
- **Offline (no AWS):** set `COGNITO_OFFLINE=true` in `.env` and the backend
  accepts the dev code `123456` (see `src/shared/cognito.ts`). Offline there is
  no email, so a newly created staff account's generated temporary password is
  logged to the terminal as
  `[cognito:offline] Temporary password for <email>: …`. The offline flow never
  emits `NEW_PASSWORD_REQUIRED`, so dev sign-in goes straight to MFA setup.

---

## Notes / troubleshooting

- **Region mismatch:** the pool must be in `COGNITO_REGION` (default
  `ap-southeast-1`) where the Lambdas run.
- **`/auth/admin/login` returns 500 "Cognito is not configured":** the
  `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` env vars are missing on the
  deployed functions — set them in `.env` and redeploy.
- **New admin never received the invitation email:** check the pool's
  **Invitation message** template contains `{####}` (Cognito skips delivery
  without it), that the default sender hasn't hit its 50/day cap, and the spam
  folder. Resend with `MessageAction: RESEND` or
  `Users → <user> → Reset password`.
- **"Invalid or expired session" during first-login password setup:** the
  short-lived `NEW_PASSWORD_REQUIRED` challenge session expired — sign in again
  with the temporary password and complete the step promptly.
- **Skipping the first-login password step:** set a permanent password
  (`Users → <user> → Reset password → Set as permanent`) or re-run the
  provisioning script for seed/admin-created users.
- **No SMS anywhere:** this implementation uses software-token MFA only. If you
  later want SMS as an alternative factor, you would need an SNS/SMS setup and
  a `phone_number` attribute — out of scope here.

---

## 6. Reset / re-enroll MFA for a stuck admin

**Symptom:** an admin signs in with the right password, the app lands on the
**Verification** step ("Enter the 6-digit code from your authenticator app"),
and every code fails with `401 Invalid or expired verification code` — the
**Authenticator Setup** (QR) step is never shown.

**Why this happens:** the admin's Cognito user has a software token
*registered* in the pool — the console shows **MFA setting: MFA active** and
**MFA methods: Authenticator app (Preferred)** — even though the human never
actually scanned a QR (e.g. a test/dev enrollment was completed with an
authenticator nobody kept). Cognito therefore returns `SOFTWARE_TOKEN_MFA` at
sign-in, which the app shows as the Verification step, and no code can ever
match the unknown secret.

**The fix — delete the orphaned software token** so the next sign-in returns an
`MFA_SETUP` challenge and the admin scans a fresh QR:

```bash
cd backend
# Add cognito-idp:AdminDeleteSoftwareToken to the IAM user/role that already
# has the other cognito-idp permissions (deploy user + Lambda role), then:
npm run reset:mfa                       # all provisioned (cognitoSub) active admins
npm run reset:mfa -- ricardo.delacruz@...   # or specific emails
npm run reset:mfa -- --dry-run          # preview only
```

Notes:
- `AdminDeleteSoftwareToken` is the correct reset operation. Per AWS docs,
  `AdminSetUserMFAPreference` does **NOT** remove an existing TOTP token.
- After the reset the admin signs in again → **Authenticator Setup** QR →
  scan → enter code → then finishes sign-in with a fresh 6-digit code.
- The QR-enrollment endpoints the frontend calls are
  `POST /auth/admin/login/totp/setup` and `POST /auth/admin/login/totp/verify`
  (registered in `serverless.yml`); make sure they are deployed (`npm run
  deploy`). `npm run verify:routes` fails the build if any of the Cognito
  endpoints (`login`, `login/mfa`, `login/totp/setup`, `login/totp/verify`) or
  their handler exports go missing, so a green build means the routes are
  registered.
