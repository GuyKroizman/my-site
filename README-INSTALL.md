# Installation Guide

## Quick Start

### First Time Setup

```bash
npm install
```

### Development

```bash
npm install          # When adding/updating dependencies
npm run dev          # Start development server
```

### Production Build

```bash
npm ci               # Clean install (use this, not npm install!)
npm run build        # Build for production
```

## Package Manager

**This project uses npm** (not yarn or pnpm).

## Work and Deployment Cycle

### Daily Development Workflow

```bash
# 1. Start working on the project
git pull                    # Get latest changes
npm install                 # Install dependencies (if package.json changed)
npm run dev                 # Start development server

# 2. Make your changes
# ... edit files ...

# 3. Test locally
npm run build              # Build to check for errors
npm run lint               # Check code quality

# 4. Commit and push
git add .
git commit -m "Your message"
git push
```

### Adding/Updating Dependencies

```bash
# Add a new package
npm install <package-name>

# Update a specific package
npm install <package-name>@latest

# Update all packages (within semver ranges)
npm update

# After installing/updating:
# 1. Test your changes
npm run dev
npm run build

# 2. Commit both files
git add package.json package-lock.json
git commit -m "Add/update: package-name"
git push
```

### Security Updates Workflow

**Run this weekly or before deployments:**

```bash
# 1. Check for vulnerabilities
npm run security:check      # or: npm audit

# 2. Fix non-breaking vulnerabilities
npm run security:fix        # or: npm audit fix

# 3. Test your application
npm run build
npm run dev                 # Test the app works

# 4. If everything works, commit
git add package-lock.json
git commit -m "Security: Fix vulnerabilities"
git push
```

**For breaking changes (requires testing):**

```bash
# 1. Check what needs fixing
npm run security:check

# 2. Fix everything (may require major version updates)
npm run security:fix:force  # or: npm audit fix --force

# 3. Test thoroughly!
npm run build
npm run lint
npm run dev
# Run your tests, check everything works

# 4. If stable, commit
git add package.json package-lock.json
git commit -m "Security: Update dependencies (breaking changes)"
git push
```

### Deployment Workflow

**This project deploys to Cloudflare Pages automatically when you push to GitHub.**

#### How It Works

1. **You push to GitHub**
   ```bash
   git push
   ```

2. **Cloudflare Pages automatically:**
   - Pulls your latest code
   - **Runs `npm ci`** (automatically detected from `package-lock.json`)
   - Runs `npm run build`
   - Deploys the `dist` folder

3. **Your site is live!**

#### ✅ No Configuration Needed!

**Good news:** Cloudflare Pages automatically uses `npm ci` when it detects your `package-lock.json` file. You don't need to configure anything - it's already secure by default!

See `CLOUDFLARE-DEPLOY.md` for more details.

#### Complete Deployment Cycle

```bash
# 1. Make your changes
# ... edit files ...

# 2. Test locally
npm run build
npm run dev

# 3. Check for security issues (optional but recommended)
npm run security:check

# 4. Commit and push
git add .
git commit -m "Your feature description"
git push

# 5. Cloudflare automatically builds and deploys
# Check Cloudflare dashboard for build status
```

### Complete Work Cycle Example

**Scenario: Adding a new feature with a new dependency**

```bash
# 1. Start fresh
git pull
npm install

# 2. Add new package
npm install some-package

# 3. Use it in your code
# ... edit files ...

# 4. Test locally
npm run dev              # Test the feature works
npm run build            # Check for build errors
npm run lint             # Check code quality

# 5. Check security (good practice)
npm run security:check

# 6. Commit everything
git add .
git commit -m "Add feature: description"
git push

# 7. Cloudflare automatically deploys
# Your site updates automatically!
```

## npm install vs npm ci

### `npm install` (Development)

- ✅ Use when adding/updating packages
- ✅ Updates `package-lock.json` if needed
- ⚠️ Can install newer versions within semver ranges
- ✅ Use for: `npm install <package-name>`, daily development

### `npm ci` (Production/CI)

- ✅ Installs exactly from `package-lock.json`
- ✅ Deletes `node_modules` first (clean install)
- ✅ Fails if lock file is out of sync
- ✅ Faster and more secure
- ✅ Use for: production builds, CI/CD pipelines, Cloudflare Pages

**Security Note:** Using `npm ci` in production prevents dependency confusion attacks by ensuring you get the exact versions you've tested, not potentially malicious newer versions.

## Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Check code quality
npm run preview          # Preview production build

# Security scripts
npm run security:check   # Check for vulnerabilities
npm run security:fix     # Fix non-breaking vulnerabilities
npm run security:fix:force # Fix all vulnerabilities (test after!)
npm run security:update  # Update and fix security issues
```

## Quick Reference

| Task | Command |
|------|---------|
| Start development | `npm run dev` |
| Add package | `npm install <package>` |
| Check security | `npm run security:check` |
| Fix security | `npm run security:fix` |
| Build locally | `npm run build` |
| Deploy | `git push` (Cloudflare auto-deploys) |
