# GCP API Key Management for GitLab Gemini CLI

Guide for managing Gemini API keys in corporate GCP accounts with project-specific tracking.

## Overview

This guide helps you:
- Create API keys using corporate GCP billing
- Track usage per project/team
- Set up monitoring and alerts
- Implement security best practices

## Prerequisites

- Corporate GCP account with billing enabled
- Owner/Editor role on the GCP project
- `gcloud` CLI installed
- Multiple GitLab projects that need separate API keys

## Step 1: Setup GCP CLI

```bash
# Install gcloud (macOS)
brew install google-cloud-sdk

# Or Linux:
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login with your corporate account
gcloud auth login

# List available projects
gcloud projects list

# Set your corporate project
gcloud config set project YOUR_CORPORATE_PROJECT_ID
```

## Step 2: Enable Required APIs

```bash
# Enable Generative Language API (Gemini)
gcloud services enable generativelanguage.googleapis.com

# Enable API Keys management
gcloud services enable apikeys.googleapis.com

# Enable monitoring (for usage tracking)
gcloud services enable monitoring.googleapis.com
```

## Step 3: Create Named API Key

### Single Project

```bash
# Create API key for a specific project
gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_domino" \
  --api-target=service=generativelanguage.googleapis.com

# Output example:
# Created API Key [projects/123456/locations/global/keys/abcd-1234-5678].
# keyString: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**IMPORTANT:** Save the `keyString` - it's shown only once!

### Multiple Projects

```bash
# Create keys for different teams/projects
gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_domino" \
  --api-target=service=generativelanguage.googleapis.com

gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_phoenix" \
  --api-target=service=generativelanguage.googleapis.com

gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_atlas" \
  --api-target=service=generativelanguage.googleapis.com
```

### With Labels (Recommended for Better Organization)

```bash
# Create key with metadata labels
gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_domino" \
  --api-target=service=generativelanguage.googleapis.com \
  --annotations=project=domino,team=backend,environment=production
```

## Step 4: Add Security Restrictions

### Restrict to Gemini API Only

```bash
# Get the key ID from create command output
# Format: projects/PROJECT_NUMBER/locations/global/keys/KEY_ID
KEY_ID="projects/123456/locations/global/keys/abcd-1234"

# Ensure key only works with Gemini API
gcloud alpha services api-keys update $KEY_ID \
  --api-target=service=generativelanguage.googleapis.com
```

### Add IP Restrictions (Optional)

If your GitLab runners have static IPs:

```bash
# Restrict to specific IPs
gcloud alpha services api-keys update $KEY_ID \
  --allowed-ips=203.0.113.10,203.0.113.20

# Or use CIDR notation
gcloud alpha services api-keys update $KEY_ID \
  --allowed-ips=203.0.113.0/24
```

### Add Referrer Restrictions (Not Recommended for CI)

```bash
# Only if calling from web apps (not applicable for GitLab CI)
gcloud alpha services api-keys update $KEY_ID \
  --allowed-referrers=https://yourdomain.com/*
```

## Step 5: List and Manage Keys

### List All Keys

```bash
# List all API keys in the project
gcloud alpha services api-keys list

# Format output as table
gcloud alpha services api-keys list --format="table(name,displayName,createTime)"

# Filter by display name
gcloud alpha services api-keys list --filter="displayName:gitlab_gemini_cli*"
```

### Get Key Details

```bash
# View specific key details
gcloud alpha services api-keys describe KEY_ID

# Get the key string (only works if you're the creator and shortly after creation)
gcloud alpha services api-keys get-key-string KEY_ID
```

### Update Key

```bash
# Update display name
gcloud alpha services api-keys update $KEY_ID \
  --display-name="gitlab_gemini_cli_domino_v2"

# Update annotations
gcloud alpha services api-keys update $KEY_ID \
  --annotations=project=domino,team=backend,environment=production,version=v2
```

### Delete Key

```bash
# Delete an API key
gcloud alpha services api-keys delete KEY_ID

# Delete without confirmation prompt
gcloud alpha services api-keys delete KEY_ID --quiet
```

## Step 6: Track Usage Per Project

### Via GCP Console

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your API keys (e.g., "gitlab_gemini_cli_domino")
3. Click on a key to view:
   - Request count
   - Error rate
   - Traffic over time

### Via GCP Console - API Dashboard

1. Go to [APIs & Services → Dashboard](https://console.cloud.google.com/apis/dashboard)
2. Click **Generative Language API**
3. View metrics filtered by credential (API key)

### Create Custom Monitoring Dashboard

1. Go to [Monitoring → Dashboards](https://console.cloud.google.com/monitoring/dashboards)
2. Click **Create Dashboard**
3. Add chart with:
   - **Resource type:** Consumed API
   - **Metric:** Request count
   - **Filter:** `service="generativelanguage.googleapis.com"`
   - **Group by:** `credential_id`
4. Save as "Gemini API Usage by Project"

### Query Usage with gcloud

```bash
# Note: Requires Cloud Monitoring API setup
# This is advanced - easier via console

gcloud monitoring time-series list \
  --filter='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="generativelanguage.googleapis.com"' \
  --format="table(resource.labels.credential_id, metric.labels.response_code_class, points.value)"
```

## Step 7: Set Up Billing Alerts

### Create Budget Alert

1. Go to [Billing → Budgets & Alerts](https://console.cloud.google.com/billing/budgets)
2. Click **Create Budget**
3. Configure:
   - **Name:** "Gemini API - gitlab_gemini_cli"
   - **Projects:** Select your project
   - **Services:** Filter to "Generative Language API"
   - **Budget amount:** e.g., $100/month
   - **Thresholds:** 50%, 75%, 90%, 100%
   - **Email notifications:** Add team emails
4. Click **Finish**

### Create Separate Budgets Per Project

Since GCP doesn't natively separate costs by API key, use tags:

```bash
# Label your API keys (already done in Step 3)
# Then filter billing exports by labels in BigQuery

# Enable billing export to BigQuery first:
# Console → Billing → Billing export → Edit settings → Enable
```

## Step 8: Automated Key Creation Script

Save as `setup-gemini-keys.sh`:

```bash
#!/bin/bash
# setup-gemini-keys.sh
# Creates Gemini API keys for multiple GitLab projects

set -euo pipefail

# Configuration
PROJECT_ID="your-corporate-project-id"
PROJECTS=("domino" "phoenix" "atlas")
TEAM="backend"
ENVIRONMENT="production"

# Setup
echo "Setting GCP project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "Enabling required APIs..."
gcloud services enable generativelanguage.googleapis.com
gcloud services enable apikeys.googleapis.com

# Create keys for each project
echo -e "\nCreating API keys..."
for proj in "${PROJECTS[@]}"; do
  echo "-----------------------------------"
  echo "Project: $proj"

  KEY_NAME="gitlab_gemini_cli_${proj}"

  # Check if key already exists
  if gcloud alpha services api-keys list --filter="displayName:${KEY_NAME}" --format="value(name)" | grep -q .; then
    echo "⚠️  Key '$KEY_NAME' already exists. Skipping..."
    continue
  fi

  # Create key
  echo "Creating API key: $KEY_NAME"
  OUTPUT=$(gcloud alpha services api-keys create \
    --display-name="$KEY_NAME" \
    --api-target=service=generativelanguage.googleapis.com \
    --annotations=project=${proj},team=${TEAM},environment=${ENVIRONMENT},tool=gitlab-gemini-cli \
    --format="value(keyString)")

  echo "✅ Created key: $KEY_NAME"
  echo "   Key String: $OUTPUT"
  echo "   ⚠️  SAVE THIS KEY - it won't be shown again!"
  echo ""
done

echo "-----------------------------------"
echo "Summary of all keys:"
gcloud alpha services api-keys list --filter="displayName:gitlab_gemini_cli*" --format="table(displayName,name,createTime)"

echo -e "\n✅ Setup complete!"
echo "Next steps:"
echo "1. Save all key strings securely"
echo "2. Add keys to GitLab CI/CD variables (GEMINI_API_KEY)"
echo "3. Set up billing alerts in GCP Console"
```

Make executable and run:

```bash
chmod +x setup-gemini-keys.sh
./setup-gemini-keys.sh
```

## Step 9: Key Rotation (Security Best Practice)

Rotate keys every 90 days:

```bash
# 1. Create new key with version suffix
gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_domino_v2" \
  --api-target=service=generativelanguage.googleapis.com \
  --annotations=project=domino,version=v2

# 2. Save the new key string

# 3. Update GitLab CI/CD variable GEMINI_API_KEY with new key

# 4. Wait 24-48 hours to ensure no jobs are using old key

# 5. Delete old key
OLD_KEY_ID="projects/123456/locations/global/keys/old-key-id"
gcloud alpha services api-keys delete $OLD_KEY_ID
```

### Automated Rotation Script

```bash
#!/bin/bash
# rotate-key.sh PROJECT_NAME

PROJECT_NAME=$1
OLD_KEY_NAME="gitlab_gemini_cli_${PROJECT_NAME}"
NEW_KEY_NAME="gitlab_gemini_cli_${PROJECT_NAME}_$(date +%Y%m%d)"

echo "Creating new key: $NEW_KEY_NAME"
NEW_KEY=$(gcloud alpha services api-keys create \
  --display-name="$NEW_KEY_NAME" \
  --api-target=service=generativelanguage.googleapis.com \
  --annotations=project=${PROJECT_NAME} \
  --format="value(keyString)")

echo "✅ New key created: $NEW_KEY"
echo ""
echo "Next steps:"
echo "1. Update GitLab CI/CD variable GEMINI_API_KEY with: $NEW_KEY"
echo "2. Wait 48 hours"
echo "3. Delete old key:"
echo "   gcloud alpha services api-keys list --filter=\"displayName:${OLD_KEY_NAME}\""
echo "   gcloud alpha services api-keys delete KEY_ID"
```

## Step 10: Cost Estimation

### Gemini API Pricing (as of 2024)

Free tier:
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per day

Paid tier (Gemini 1.5 Pro):
- Input: ~$3.50 per 1M tokens
- Output: ~$10.50 per 1M tokens

### Estimate for Code Review

Typical MR review:
- ~5,000 tokens input (diffs + prompt)
- ~1,000 tokens output (comments)
- Cost per review: ~$0.03

For 100 MRs/month:
- ~$3/month per project
- Well within free tier for most teams

## Troubleshooting

### "Permission denied" when creating keys

```bash
# Check your role
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:YOUR_EMAIL"

# You need one of:
# - roles/owner
# - roles/editor
# - roles/serviceusage.apiKeysAdmin
```

### "API [apikeys.googleapis.com] not enabled"

```bash
# Enable the API Keys API
gcloud services enable apikeys.googleapis.com
```

### Cannot see key string after creation

**Key strings are only shown once at creation.** If lost:
1. Delete the old key
2. Create a new key
3. Update GitLab CI/CD variables

### Key not working in GitLab CI

Check:
1. **Correct API enabled:** `generativelanguage.googleapis.com`
2. **No IP restrictions:** Remove if runners have dynamic IPs
3. **Key in GitLab variables:** Masked but not protected (during testing)
4. **No extra spaces:** Trim whitespace when copying key

## Best Practices

### Security

- ✅ Use separate keys per project/team
- ✅ Restrict to Gemini API only (`--api-target`)
- ✅ Add IP restrictions if runners have static IPs
- ✅ Rotate keys every 90 days
- ✅ Store keys in GitLab masked variables
- ✅ Use service accounts for production (advanced)

### Cost Management

- ✅ Set billing alerts at multiple thresholds
- ✅ Monitor usage weekly via GCP Console
- ✅ Use free tier for development/testing
- ✅ Limit reviews to main branches in production

### Organization

- ✅ Use descriptive names: `gitlab_gemini_cli_<project>`
- ✅ Add annotations/labels for filtering
- ✅ Document which key belongs to which GitLab project
- ✅ Maintain a key inventory spreadsheet

### Monitoring

- ✅ Create monitoring dashboards per project
- ✅ Set up alerts for unusual usage spikes
- ✅ Review usage monthly in team meetings
- ✅ Track cost trends over time

## Quick Reference

```bash
# Create key
gcloud alpha services api-keys create \
  --display-name="gitlab_gemini_cli_PROJECT" \
  --api-target=service=generativelanguage.googleapis.com

# List keys
gcloud alpha services api-keys list

# Get key details
gcloud alpha services api-keys describe KEY_ID

# Delete key
gcloud alpha services api-keys delete KEY_ID

# Update key
gcloud alpha services api-keys update KEY_ID \
  --display-name="new-name"
```

## Resources

- [GCP API Keys Documentation](https://cloud.google.com/docs/authentication/api-keys)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [GCP Billing Documentation](https://cloud.google.com/billing/docs)
- [Cloud Monitoring](https://cloud.google.com/monitoring/docs)

---

**Last Updated:** 2025-10-06
