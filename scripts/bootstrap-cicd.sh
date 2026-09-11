#!/usr/bin/env bash
#
# One-time bootstrap for KaBarangayConnect CI/CD.
#
# Everything after this runs hands-off on every merge to `main`. This script
# exists because AWS will not let GitHub Actions self-authorize into an account
# that has no role to assume — so somebody has to run this once with admin
# credentials.
#
# It creates (idempotently — safe to re-run):
#   1. the GitHub OIDC identity provider in IAM;
#   2. the deploy role GitHub Actions assumes, scoped to this repo's `main`;
#   3. the AWS Amplify app + branch (reusing an existing app if one matches);
#   4. every GitHub Actions secret and variable the workflows read, sourced
#      from backend/.env and the values discovered above.
#
# Usage:
#   ./scripts/bootstrap-cicd.sh                  # do everything
#   SKIP_GITHUB=1 ./scripts/bootstrap-cicd.sh    # AWS setup only
#
# Requires: aws CLI (authenticated as an admin), and for step 4 the `gh` CLI
# (authenticated). A GitHub PAT is needed ONLY if the Amplify app does not exist
# yet and must be created programmatically — set GITHUB_PAT for that.
#
# Docs: docs/CICD.md
set -euo pipefail

# --- Configuration (override any of these via the environment) --------------
REPO_SLUG="${REPO_SLUG:-Resulex/Capstone2-A4104-Group4-SY26-27}"
ROLE_NAME="${ROLE_NAME:-GitHubActionsDeploy-KaBarangayConnect}"
POLICY_NAME="${POLICY_NAME:-kabarangayconnect-deploy}"
OIDC_HOST="${OIDC_HOST:-token.actions.githubusercontent.com}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
STAGE="${STAGE:-dev}"
AMPLIFY_APP_NAME="${AMPLIFY_APP_NAME:-kabarangayconnect-frontend}"
AMPLIFY_BRANCH_NAME="${AMPLIFY_BRANCH_NAME:-main}"
API_BACKEND_URL="${API_BACKEND_URL:-https://5p91o0g2ea.execute-api.ap-southeast-1.amazonaws.com}"
# Serverless provisions its deployment bucket and Lambda execution role under
# this prefix (service name `kabarangayconnect-backend`).
SERVERLESS_BUCKET_PREFIX="${SERVERLESS_BUCKET_PREFIX:-kabarangayconnect-backend-}"
SERVERLESS_ROLE_PREFIX="${SERVERLESS_ROLE_PREFIX:-kabarangayconnect-backend}"
MEDIA_BUCKET_NAME="${MEDIA_BUCKET_NAME:-kabarangayconnect-media}"
SESSION_COOKIE_MAX_AGE_SECONDS="${SESSION_COOKIE_MAX_AGE_SECONDS:-604800}"
SKIP_GITHUB="${SKIP_GITHUB:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/backend/.env"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[0;32m+\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[x]\033[0m %s\n\n' "$*" >&2; exit 1; }

# --- Preflight --------------------------------------------------------------
info "Preflight"
command -v aws >/dev/null 2>&1 || die "aws CLI not found. Install it first: https://aws.amazon.com/cli/"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" \
  || die "Could not resolve AWS identity. Configure admin credentials (AWS_PROFILE or ~/.aws/credentials) and retry."
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
ok "AWS account ${ACCOUNT_ID} as ${CALLER_ARN}"
ok "region ${AWS_REGION}, stage ${STAGE}, repo ${REPO_SLUG}"

if [ "${SKIP_GITHUB}" != "1" ]; then
  command -v gh >/dev/null 2>&1 || die "gh CLI not found. Install it, or re-run with SKIP_GITHUB=1 to configure AWS only."
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run 'gh auth login', or re-run with SKIP_GITHUB=1."
  ok "gh CLI authenticated"
fi

# --- 1. GitHub OIDC provider ------------------------------------------------
info "1/4  GitHub OIDC identity provider"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_HOST}"
if aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text \
    | tr '\t' '\n' | grep -qx "${PROVIDER_ARN}"; then
  ok "already exists: ${PROVIDER_ARN}"
else
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_HOST}" \
    --client-id-list sts.amazonaws.com \
    --output text >/dev/null
  ok "created: ${PROVIDER_ARN}"
fi

# --- 2. Deploy role ---------------------------------------------------------
info "2/4  Deploy role"
cat > "${WORK_DIR}/trust.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_HOST}:aud": "sts.amazonaws.com",
          "${OIDC_HOST}:sub": "repo:${REPO_SLUG}:ref:refs/heads/${DEPLOY_BRANCH}"
        }
      }
    }
  ]
}
JSON

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" \
    --policy-document "file://${WORK_DIR}/trust.json"
  ok "role exists; trust policy refreshed"
else
  aws iam create-role --role-name "${ROLE_NAME}" \
    --description "GitHub Actions deploy role for ${REPO_SLUG}" \
    --assume-role-policy-document "file://${WORK_DIR}/trust.json" \
    --output text >/dev/null
  ok "role created"
fi
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

cat > "${WORK_DIR}/policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationRead",
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks", "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResource", "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate", "cloudformation:GetTemplateSummary",
        "cloudformation:ListStacks", "cloudformation:ListStackResources",
        "cloudformation:ValidateTemplate", "cloudformation:DescribeChangeSet",
        "cloudformation:ListChangeSets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFormationWrite",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack", "cloudformation:UpdateStack",
        "cloudformation:DeleteStack", "cloudformation:CreateChangeSet",
        "cloudformation:ExecuteChangeSet", "cloudformation:DeleteChangeSet"
      ],
      "Resource": "arn:aws:cloudformation:${AWS_REGION}:${ACCOUNT_ID}:stack/*/*"
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:AddPermission", "lambda:CreateFunction", "lambda:DeleteFunction",
        "lambda:GetFunction", "lambda:GetFunctionConfiguration", "lambda:GetPolicy",
        "lambda:ListFunctions", "lambda:ListTags", "lambda:PublishVersion",
        "lambda:RemovePermission", "lambda:TagResource", "lambda:UntagResource",
        "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ApiGateway",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET", "apigateway:POST", "apigateway:PUT",
        "apigateway:PATCH", "apigateway:DELETE"
      ],
      "Resource": "arn:aws:apigateway:${AWS_REGION}::/*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup", "logs:DeleteLogGroup", "logs:DescribeLogGroups",
        "logs:DescribeSubscriptionFilters", "logs:FilterLogEvents",
        "logs:PutRetentionPolicy", "logs:PutSubscriptionFilter",
        "logs:TagResource", "logs:UntagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ServerlessDeployBucket",
      "Effect": "Allow",
      "Action": ["s3:CreateBucket", "s3:ListBucket", "s3:GetBucketLocation", "s3:PutBucketPolicy", "s3:PutBucketTagging", "s3:GetBucketTagging"],
      "Resource": "arn:aws:s3:::${SERVERLESS_BUCKET_PREFIX}*"
    },
    {
      "Sid": "ServerlessDeployObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${SERVERLESS_BUCKET_PREFIX}*/*"
    },
    {
      "Sid": "MediaBucketForPresignHandler",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${MEDIA_BUCKET_NAME}/*"
    },
    {
      "Sid": "LambdaExecutionRole",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:PassRole",
        "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:PutRolePolicy",
        "iam:DeleteRolePolicy", "iam:GetRolePolicy", "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies", "iam:ListRoleTags", "iam:TagRole", "iam:UntagRole"
      ],
      "Resource": "arn:aws:iam::${ACCOUNT_ID}:role/${SERVERLESS_ROLE_PREFIX}*"
    },
    {
      "Sid": "AmplifyHosting",
      "Effect": "Allow",
      "Action": ["amplify:GetApp", "amplify:GetBranch", "amplify:UpdateBranch", "amplify:StartJob", "amplify:GetJob", "amplify:ListJobs"],
      "Resource": "arn:aws:amplify:${AWS_REGION}:${ACCOUNT_ID}:apps/*"
    },
    {
      "Sid": "AmplifyList",
      "Effect": "Allow",
      "Action": ["amplify:ListApps"],
      "Resource": "*"
    },
    {
      "Comment": "Only needed if provision:cognito / reset:mfa ever run from CI.",
      "Sid": "CognitoMaintenanceScripts",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:ListUserPools", "cognito-idp:DescribeUserPool",
        "cognito-idp:ListUsers", "cognito-idp:AdminGetUser",
        "cognito-idp:AdminSetUserPassword", "cognito-idp:AdminResetUserPassword",
        "cognito-idp:AdminUserGlobalSignOut"
      ],
      "Resource": "*"
    }
  ]
}
JSON

aws iam put-role-policy --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${WORK_DIR}/policy.json"
ok "inline policy '${POLICY_NAME}' applied (least-privilege; AdministratorAccess is the looser alternative)"
ok "role ARN: ${ROLE_ARN}"

# --- 3. Amplify app + branch ------------------------------------------------
info "3/4  Amplify app + branch"
APP_ID="$(aws amplify list-apps --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId" --output text 2>/dev/null || true)"
# `list-apps` prints "None" for an empty match.
if [ "${APP_ID}" = "None" ] || [ -z "${APP_ID}" ]; then
  APP_ID=""
fi

if [ -n "${APP_ID}" ]; then
  ok "reusing existing app '${AMPLIFY_APP_NAME}': ${APP_ID}"
else
  if [ -z "${GITHUB_PAT:-}" ]; then
    warn "No Amplify app named '${AMPLIFY_APP_NAME}' exists yet."
    warn "Creating one programmatically needs a GitHub PAT, because the Amplify API"
    warn "must authenticate to GitHub to attach the repository."
    die "Re-run with GITHUB_PAT=<classic PAT with 'repo' scope>, or create the app in the Amplify console (connect this repo, branch '${AMPLIFY_BRANCH_NAME}') and re-run this script."
  fi
  APP_ID="$(aws amplify create-app \
    --name "${AMPLIFY_APP_NAME}" \
    --description "KaBarangayConnect Next.js frontend (${REPO_SLUG})" \
    --repository "https://github.com/${REPO_SLUG}" \
    --platform WEB_COMPUTE \
    --access-token "${GITHUB_PAT}" \
    --no-enable-branch-auto-build \
    --environment-variables "API_BACKEND_URL=${API_BACKEND_URL},API_BACKEND_STAGE=${STAGE}" \
    --query 'app.appId' --output text)"
  ok "created app: ${APP_ID}"
fi

PLATFORM="$(aws amplify get-app --app-id "${APP_ID}" --query 'app.platform' --output text)"
if [ "${PLATFORM}" != "WEB_COMPUTE" ]; then
  warn "App platform is '${PLATFORM}', but Next.js SSR requires WEB_COMPUTE."
  warn "Fix it with: aws amplify update-app --app-id ${APP_ID} --platform WEB_COMPUTE"
else
  ok "platform: WEB_COMPUTE"
fi

BRANCH_ENV="API_BACKEND_URL=${API_BACKEND_URL},API_BACKEND_STAGE=${STAGE},SESSION_COOKIE_MAX_AGE_SECONDS=${SESSION_COOKIE_MAX_AGE_SECONDS},COOKIE_SECURE=true"
if aws amplify get-branch --app-id "${APP_ID}" --branch-name "${AMPLIFY_BRANCH_NAME}" >/dev/null 2>&1; then
  aws amplify update-branch --app-id "${APP_ID}" --branch-name "${AMPLIFY_BRANCH_NAME}" \
    --stage PRODUCTION --no-enable-auto-build \
    --environment-variables "${BRANCH_ENV}" --output text >/dev/null
  ok "branch '${AMPLIFY_BRANCH_NAME}' updated (auto-build disabled)"
else
  aws amplify create-branch --app-id "${APP_ID}" --branch-name "${AMPLIFY_BRANCH_NAME}" \
    --stage PRODUCTION --no-enable-auto-build \
    --environment-variables "${BRANCH_ENV}" --output text >/dev/null
  ok "branch '${AMPLIFY_BRANCH_NAME}' created (auto-build disabled)"
fi
warn "Auto-build is OFF on purpose: the deploy workflow triggers Amplify itself,"
warn "so it can guarantee the backend is live before the frontend is released."

# --- 4. Wire GitHub ---------------------------------------------------------
if [ "${SKIP_GITHUB}" = "1" ]; then
  info "4/4  GitHub wiring skipped (SKIP_GITHUB=1)"
  cat <<SUMMARY

Add these to ${REPO_SLUG} -> Settings -> Secrets and variables -> Actions:

  Secret    AWS_DEPLOY_ROLE_ARN = ${ROLE_ARN}
  Variable  AWS_REGION          = ${AWS_REGION}
  Variable  STAGE               = ${STAGE}
  Variable  API_BACKEND_URL     = ${API_BACKEND_URL}
  Variable  AMPLIFY_APP_ID      = ${APP_ID}
  Variable  AMPLIFY_BRANCH_NAME = ${AMPLIFY_BRANCH_NAME}

Plus MONGODB_URI, JWT_SECRET, TOTP_SECRET_ENCRYPTION_KEY, GOOGLE_CLIENT_SECRET
(and the COGNITO_*/GOOGLE_*/S3_*/TOTP_* variables listed in docs/CICD.md).
SUMMARY
  exit 0
fi

info "4/4  Wiring GitHub secrets and variables"

# Read a value out of backend/.env, ignoring comments and stripping quotes.
env_value() {
  local key="$1"
  [ -f "${ENV_FILE}" ] || return 1
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -1 || true)"
  [ -n "${line}" ] || return 1
  local value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "${value}" | sed -e 's/[[:space:]]*$//'
}

set_secret() {
  local key="$1" value="$2"
  if [ -z "${value}" ]; then
    warn "skipped secret ${key} (no value found in backend/.env)"
    return 0
  fi
  printf '%s' "${value}" | gh secret set "${key}" --repo "${REPO_SLUG}" >/dev/null
  ok "secret   ${key}"
}

set_variable() {
  local key="$1" value="$2"
  if [ -z "${value}" ]; then
    warn "skipped variable ${key} (empty)"
    return 0
  fi
  gh variable set "${key}" --repo "${REPO_SLUG}" --body "${value}" >/dev/null
  ok "variable ${key}"
}

set_secret   AWS_DEPLOY_ROLE_ARN            "${ROLE_ARN}"
set_variable AWS_REGION                     "${AWS_REGION}"
set_variable STAGE                          "${STAGE}"
set_variable API_BACKEND_URL                "${API_BACKEND_URL}"
set_variable AMPLIFY_APP_ID                 "${APP_ID}"
set_variable AMPLIFY_BRANCH_NAME            "${AMPLIFY_BRANCH_NAME}"
set_variable SESSION_COOKIE_MAX_AGE_SECONDS "${SESSION_COOKIE_MAX_AGE_SECONDS}"

for key in MONGODB_URI JWT_SECRET TOTP_SECRET_ENCRYPTION_KEY GOOGLE_CLIENT_SECRET OAUTH_STATE_SECRET; do
  set_secret "${key}" "$(env_value "${key}" || true)"
done

for key in JWT_EXPIRES_IN TOTP_ISSUER TOTP_ENROLLMENT_JWT_TTL COGNITO_USER_POOL_ID \
           COGNITO_CLIENT_ID COGNITO_REGION GOOGLE_CLIENT_ID GOOGLE_REDIRECT_URI \
           S3_BUCKET_NAME S3_BUCKET_REGION; do
  set_variable "${key}" "$(env_value "${key}" || true)"
done

if grep -qE '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=' "${ENV_FILE}" 2>/dev/null; then
  warn "backend/.env contains long-lived AWS keys. CI uses OIDC and does not need"
  warn "them, and committed-and-shared keys are a liability — consider rotating"
  warn "them and removing them from that file."
fi

# --- Summary ----------------------------------------------------------------
DEPLOY_URL="https://${AMPLIFY_BRANCH_NAME}.$(aws amplify get-app --app-id "${APP_ID}" --query 'app.defaultDomain' --output text)"
cat <<SUMMARY

$(printf '\033[1;32mBootstrap complete.\033[0m')

  Deploy role      ${ROLE_ARN}
  Amplify app      ${APP_ID}  (${AMPLIFY_APP_NAME}, branch ${AMPLIFY_BRANCH_NAME})
  Frontend URL     ${DEPLOY_URL}
  Backend API      ${API_BACKEND_URL}/${STAGE}

Next: merge to ${DEPLOY_BRANCH} and .github/workflows/deploy.yml takes over —
backend deploy, migrations + verification, then the Amplify build.

To trigger it now without merging anything:
  gh workflow run deploy.yml --repo ${REPO_SLUG} --ref ${DEPLOY_BRANCH}
SUMMARY
