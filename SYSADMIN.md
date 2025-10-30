# GitLab Runner Setup for Gemini CLI Auto-Review

Follow these steps to provision one shared Linux runner with the Docker executor.

## Requirements
- Ubuntu 20.04+/RHEL 8+ server with sudo
- Outbound HTTPS access to your GitLab instance and Docker Hub (or your registry)
- 2+ CPU cores, 4GB RAM, 20GB free disk

## 1. Install Docker
**Ubuntu/Debian**
```bash
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl enable --now docker
sudo docker --version
```
**RHEL/CentOS/Amazon Linux**
```bash
sudo yum install -y docker
sudo systemctl enable --now docker
sudo docker --version
```

## 2. Install GitLab Runner
**Ubuntu/Debian**
```bash
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install -y gitlab-runner
sudo gitlab-runner --version
```
**RHEL/CentOS/Amazon Linux**
```bash
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh" | sudo bash
sudo yum install -y gitlab-runner
sudo gitlab-runner --version
```

## 3. Allow Docker Access
```bash
sudo usermod -aG docker gitlab-runner
sudo systemctl restart gitlab-runner
sudo -u gitlab-runner -H docker info
```

## 4. Register Runner (shared scope recommended)
Get the registration token from **Admin Area → Overview → Runners**.
```bash
sudo gitlab-runner register --non-interactive \
  --url "https://your-gitlab.com/" \
  --registration-token "TOKEN" \
  --executor "docker" \
  --description "Gemini CLI Docker Runner" \
  --tag-list "gemini-review,docker,linux" \
  --docker-image "node:20-alpine" \
  --run-untagged="false" \
  --docker-privileged="false"
```

## 5. Configure `/etc/gitlab-runner/config.toml`
```toml
concurrent = 4

[[runners]]
  name = "Gemini CLI Docker Runner"
  url = "https://your-gitlab.com/"
  token = "REPLACE_WITH_AUTHTOKEN"
  executor = "docker"
  environment = ["FF_NETWORK_PER_BUILD=1"]

  [runners.docker]
    image = "node:20-alpine"
    privileged = false
    volumes = ["/cache"]
    allowed_images = ["node:*", "alpine:*", "docker.io/library/*"]
    allowed_services = ["docker.io/library/*"]
```
Adjust `concurrent` based on CPU/RAM. Keep `privileged = false` unless absolutely required.

## 6. Restart and Verify
```bash
sudo systemctl restart gitlab-runner
sudo gitlab-runner verify
```
Check **Admin Area → Overview → Runners** for an online status and the `gemini-review` tag.

## Monthly Maintenance
```bash
sudo gitlab-runner list
sudo apt-get update && sudo apt-get upgrade gitlab-runner docker.io  # use yum on RHEL
sudo docker system prune -a --filter "until=720h"
```
Review `sudo journalctl -u gitlab-runner` for errors.

## Troubleshooting Quick Checks
- Runner offline → `sudo systemctl status gitlab-runner`
- Jobs pending → confirm tags in job `.gitlab-ci.yml` match runner tags
- Docker permission errors → re-run Step 3
- "Image not allowed" → update `allowed_images` and restart the runner
