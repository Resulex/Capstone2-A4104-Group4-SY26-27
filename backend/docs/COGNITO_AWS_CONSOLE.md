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
   - Not needed for TOTP. Keep the defaults (Cognito still needs an email
     sender for its messages; if you don't configure SES it uses the pool's
     default Cognito sender — fine, we don't email anyway). Click **Next**.
6. **Step 4 – Add app clients** (this can also be done later — see §2)
   - Create a new client (see §2) or continue and add it after. Click **Next**.
7. **Step 5 – Set up integrations / attributes**
   - **Email** is required. You do NOT need `phone_number`.
   - Click **Next**, review, and click **Create user pool**.

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
3. Enter a **temporary/password**, and make sure **"Users must create a new
   password on first sign-in" is UNCHECKED** (set it as permanent) — otherwise
   the backend hits the `NEW_PASSWORD_REQUIRED` challenge we don't handle.
4. Create. Repeat for each admin.
   - Note: console-created users won't have `cognitoSub` stored in Mongo until
     their first successful login (the MFA step writes it automatically), so
     running the provisioning script once is still the cleaner path.

> New admins created later via `POST /admins` in the app are provisioned
> automatically, so you only do this for existing/seed admins.

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

- **First login (enrollment):** sign in at `/admin/login` → password step →
  you are prompted with a **QR code** → scan it with Google Authenticator (or
  Authy) → enter the 6-digit code → sign in again with a code → dashboard.
- **Subsequent logins:** email + password → 6-digit code → dashboard.
- **Wrong code** → `401 Invalid or expired verification code`.
- **Offline (no AWS):** set `COGNITO_OFFLINE=true` in `.env` and the backend
  accepts the dev code `123456` (see `src/shared/cognito.ts`).

---

## Notes / troubleshooting

- **Region mismatch:** the pool must be in `COGNITO_REGION` (default
  `ap-southeast-1`) where the Lambdas run.
- **`/auth/admin/login` returns 500 "Cognito is not configured":** the
  `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` env vars are missing on the
  deployed functions — set them in `.env` and redeploy.
- **"A password change is required" error:** the pool user was created with a
  temporary password (Option B without unchecking the force-change box). Fix by
  setting a permanent password (`Users → <user> → Reset password → Set as
  permanent`) or re-running the provisioning script.
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
  deploy`).
