# GitLab Runner Setup for Gemini CLI Auto-Review

**Target Audience:** System administrators and DevOps engineers managing self-hosted GitLab instances.

This guide covers setting up a shared GitLab Runner on Linux with Docker executor for running Gemini CLI code review jobs across multiple projects.

## Overview

For the `gitlab_gemini_cli` feature to work organization-wide:
- **One-time setup:** Sysadmin creates a shared GitLab Runner (this guide)
- **Per-project:** Developers install the feature following README.md

The runner will execute AI code review jobs in isolated Docker containers.

## Prerequisites

- Linux server (Ubuntu 20.04+, RHEL/CentOS 8+, or similar)
- Root or sudo access
- Network access to your GitLab instance
- At least 2 CPU cores and 4GB RAM (recommended for concurrent jobs)
- Internet access for pulling Docker images

## Step 1: Install Docker

The Gemini CLI runner uses Docker executor, so Docker must be installed first.

**Ubuntu/Debian:**
```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io

# Start and enable Docker service
sudo systemctl enable docker --now
sudo systemctl status docker

# Verify installation
docker --version
```

**RHEL/CentOS/Amazon Linux:**
```bash
# Install Docker
sudo yum install -y docker

# Start and enable Docker service
sudo systemctl enable docker --now
sudo systemctl status docker

# Verify installation
docker --version
```

**Minimum Docker version:** Docker 1.13.0+ (API v1.25), but use Docker 20+ or latest stable for best compatibility.

## Step 2: Install GitLab Runner

**Ubuntu/Debian:**
```bash
# Add GitLab's official Runner repository
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash

# Install GitLab Runner
sudo apt-get install -y gitlab-runner

# Verify installation
gitlab-runner --version
```

**RHEL/CentOS/Amazon Linux:**
```bash
# Add GitLab's official Runner repository
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh" | sudo bash

# Install GitLab Runner
sudo yum install -y gitlab-runner

# Verify installation
gitlab-runner --version
```

**Version Compatibility:** Match the GitLab Runner version with your GitLab instance version (major.minor). For example, if GitLab is v16.4, install Runner 16.4.x. This ensures full feature compatibility.

## Step 3: Grant Docker Access to Runner

The `gitlab-runner` user needs permission to use Docker:

```bash
# Add gitlab-runner user to docker group
sudo usermod -aG docker gitlab-runner

# Verify docker access
sudo -u gitlab-runner -H docker info
```

**Security Note:** Users in the `docker` group have root-equivalent privileges. This is necessary for the runner but should be limited to the runner service account only.

## Step 4: Register the Runner

You'll need a **registration token** from GitLab. Choose the runner scope:

### Shared Runner (Recommended for Organization-Wide Use)

**For Admins (Instance-Wide):**
1. GitLab → **Admin Area → Overview → Runners**
2. Find **"Register an instance runner"** section
3. Copy the registration token

**Register the runner:**
```bash
sudo gitlab-runner register
```

**Interactive prompts:**
- **GitLab instance URL:** `https://your-gitlab.com/`
- **Registration token:** Paste the token from GitLab
- **Description:** `Gemini CLI Docker Runner`
- **Tags:** `gemini-review,docker,linux`
- **Executor:** `docker`
- **Default Docker image:** `node:20-alpine`

**Non-interactive (for automation):**
```bash
sudo gitlab-runner register --non-interactive \
  --url "https://your-gitlab.com/" \
  --registration-token "YOUR_INSTANCE_TOKEN" \
  --executor "docker" \
  --description "Gemini CLI Docker Runner" \
  --tag-list "gemini-review,docker,linux" \
  --docker-image "node:20-alpine" \
  --docker-privileged="false" \
  --run-untagged="false"
```

### Group Runner (For Department/Team)

1. GitLab → **Group Settings → CI/CD → Runners**
2. Find group registration token
3. Use same registration command as above with the group token

### Project Runner (For Single Project)

1. GitLab → **Project Settings → CI/CD → Runners**
2. Find project registration token
3. Use same registration command with project token

**Important Settings:**
- **Tags:** `gemini-review,docker,linux` - Jobs will match these tags
- **Run untagged jobs:** `false` - Only run jobs explicitly tagged (safer)
- **Privileged mode:** `false` - Keep disabled for security

## Step 5: Configure Runner (config.toml)

Edit `/etc/gitlab-runner/config.toml` for production settings:

```toml
concurrent = 4  # Max parallel jobs (adjust based on CPU/RAM)

[[runners]]
  name = "Gemini CLI Docker Runner"
  url = "https://your-gitlab.com/"
  token = "RUNNER_AUTH_TOKEN"  # Auto-generated during registration
  executor = "docker"

  # Feature flag: isolate network per job (GitLab 13.8+)
  environment = ["FF_NETWORK_PER_BUILD=1"]

  [runners.docker]
    # Default image if .gitlab-ci.yml doesn't specify
    image = "node:20-alpine"

    # Security: do NOT run privileged containers
    privileged = false

    # Enable caching for faster builds
    disable_cache = false
    volumes = ["/cache"]

    # Restrict allowed Docker images (IMPORTANT for security)
    allowed_images = [
      "node:*",
      "alpine:*",
      "docker.io/library/*"
    ]

    # Allowed service images (databases for testing)
    allowed_services = [
      "docker.io/library/*"
    ]

    # Pull policy: always check for updates
    allowed_pull_policies = ["always", "if-not-present"]

    # Shared memory size (0 = Docker default 64MB)
    shm_size = 0
```

**Key Security Settings:**

| Setting | Value | Why |
|---------|-------|-----|
| `privileged` | `false` | Prevents container escape to host |
| `allowed_images` | Whitelist | Blocks untrusted images |
| `allowed_services` | Whitelist | Restricts service containers |
| `FF_NETWORK_PER_BUILD` | `1` | Isolates job networks |

**After editing config.toml:**
```bash
# Restart runner to apply changes
sudo systemctl restart gitlab-runner

# Verify runner is online
sudo gitlab-runner verify
```

## Step 6: Verify Runner in GitLab

1. Go to GitLab → **Admin Area → Overview → Runners** (for instance runners)
2. You should see your runner listed as **online** (green dot)
3. Note the tags: `gemini-review`, `docker`, `linux`
4. Jobs with these tags will run on this runner

## Security Best Practices

### 1. Image Whitelisting
Only allow trusted images in `allowed_images`:
```toml
allowed_images = [
  "node:20-alpine",           # Required for Gemini CLI
  "registry.yourcompany.com/*"  # Your private registry
]
```

### 2. Protected Runners (for Sensitive Projects)
For runners with deployment credentials:
1. GitLab → Runner settings → Check **"Protected"**
2. Runner only executes jobs on protected branches (e.g., `main`)
3. Prevents untrusted code from accessing secrets

### 3. Resource Limits
Prevent job resource exhaustion:
```toml
[runners.docker]
  memory = "2g"      # Limit container RAM
  cpus = "2"         # Limit CPU cores
```

### 4. Network Isolation
- Runner host should be on a separate network segment
- Limit outbound access if possible
- Use `FF_NETWORK_PER_BUILD=1` to isolate job networks

### 5. Regular Updates
```bash
# Update GitLab Runner (Ubuntu/Debian)
sudo apt-get update && sudo apt-get upgrade gitlab-runner

# Update Docker
sudo apt-get upgrade docker.io

# Restart services
sudo systemctl restart docker gitlab-runner
```

### 6. Monitoring
Enable Prometheus metrics (optional):
```toml
[[runners]]
  metrics_server = "0.0.0.0:9252"  # Expose metrics for monitoring
```

## Troubleshooting

### Runner shows offline in GitLab

**Check service status:**
```bash
sudo systemctl status gitlab-runner
sudo journalctl -u gitlab-runner -f
```

**Common causes:**
- Network connectivity to GitLab server
- Invalid authentication token (re-register if needed)
- Firewall blocking outbound HTTPS

### Jobs stuck in "pending"

**Check runner tags:**
- Job's `.gitlab-ci.yml` must have matching tags
- Runner must have `run_untagged = true` OR job must use runner's tags

**Verify runner capacity:**
```bash
# Check if concurrent limit reached
sudo gitlab-runner status
```

### Docker permission errors

**Fix docker group:**
```bash
# Re-add user and restart
sudo usermod -aG docker gitlab-runner
sudo systemctl restart gitlab-runner
```

### "Image not allowed" errors

**Update `allowed_images` in config.toml:**
```toml
allowed_images = ["node:*", "alpine:*"]
```

Then restart: `sudo systemctl restart gitlab-runner`

## Capacity Planning

**For Gemini CLI review jobs:**
- Each job: ~500MB RAM, 1 CPU core
- Duration: 1-3 minutes per MR
- Recommended: `concurrent = 4` for 4 CPU / 8GB RAM server

**Scaling:**
- **Vertical:** Increase `concurrent` value
- **Horizontal:** Add more runner hosts (register multiple runners)
- **Autoscaling:** Use GitLab Runner with Docker Machine or Kubernetes executor

## Maintenance

**Monthly tasks:**
```bash
# Check runner status
sudo gitlab-runner list

# Verify runner in GitLab UI
# Admin Area → Runners → ensure green "online" status

# Update packages
sudo apt-get update && sudo apt-get upgrade gitlab-runner docker.io

# Clean up old Docker images/containers
docker system prune -a --filter "until=720h"  # Remove images older than 30 days
```

**Quarterly tasks:**
- Review runner logs for errors: `sudo journalctl -u gitlab-runner --since "3 months ago"`
- Verify security settings in config.toml
- Check GitLab version and upgrade runner if needed

## Advanced: Terraform Deployment

For infrastructure-as-code deployment, use Terraform to provision runners:

**Example (AWS EC2):**
```hcl
resource "aws_instance" "gitlab_runner" {
  ami           = "ami-0abcdef1234567890"  # Ubuntu 22.04
  instance_type = "t3.medium"

  user_data = <<-EOF
    #!/bin/bash
    apt-get update && apt-get install -y docker.io
    curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | bash
    apt-get install -y gitlab-runner

    gitlab-runner register --non-interactive \
      --url "${var.gitlab_url}" \
      --registration-token "${var.registration_token}" \
      --executor "docker" \
      --description "Terraform Runner" \
      --tag-list "gemini-review,docker" \
      --docker-image "node:20-alpine"
  EOF

  tags = {
    Name = "GitLab Runner - Gemini CLI"
  }
}
```

See [GitLab Runner Infrastructure Toolkit (GRIT)](https://docs.gitlab.com/runner/grit/) for production-ready Terraform modules.

## Support

For developer questions about using the runner:
- See [README.md](README.md) for installation guide

For runner administration:
- [GitLab Runner Docs](https://docs.gitlab.com/runner/)
- [Docker Executor Docs](https://docs.gitlab.com/runner/executors/docker/)

---

**Setup Time:** 30-60 minutes (one-time per organization)
**Maintenance:** ~30 minutes/month
