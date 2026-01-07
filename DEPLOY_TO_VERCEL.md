# Deploy to Vercel from Branch

## Current Branch
`fix/property-legal-sections`

## Deployment Options

### Option 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `lifevault`

2. **Create New Deployment**
   - Click "Deployments" tab
   - Click "Create Deployment" button
   - Select:
     - **Git Repository**: Your GitHub repo
     - **Branch**: `fix/property-legal-sections`
     - **Root Directory**: `frontend` (if your project structure requires it)
   - Click "Deploy"

3. **Monitor Deployment**
   - Watch the build logs in real-time
   - Deployment URL will be provided once complete

### Option 2: Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

3. **Deploy from current branch**:
   ```bash
   vercel --prod
   ```
   
   Or to deploy as a preview:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Confirm project settings
   - Vercel will detect the current branch and deploy

### Option 3: GitHub Integration (Auto-Deploy)

If your Vercel project is connected to GitHub:

1. **Configure Branch Deployment**:
   - Go to Vercel Dashboard → Project Settings → Git
   - Ensure "Production Branch" is set correctly
   - Preview deployments are created automatically for all branches

2. **Create Pull Request** (if deploying as preview):
   - Create a PR from `fix/property-legal-sections` to your main branch
   - Vercel will automatically create a preview deployment

3. **Merge to Main** (for production):
   - Once ready, merge the branch to main
   - Vercel will automatically deploy to production

## Important Notes

### Environment Variables
Make sure all required environment variables are set in Vercel:
- Go to Project Settings → Environment Variables
- Add/update variables for:
  - Database connection (`DATABASE_URL`)
  - AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.)
  - Email configuration (`EMAIL_FROM`, etc.)
  - JWT secrets (`JWT_SECRET`, `NEXTAUTH_SECRET`)
  - Server secrets (`SERVER_PART_B_SECRET`, etc.)

### Database Migrations
After deployment, run any pending migrations:
```bash
# Via Vercel CLI or SSH into deployment
cd frontend
npx prisma migrate deploy
```

### Cron Jobs
The `vercel.json` file includes cron job configuration:
- `/api/nominee/access/check-inactivity` - Runs daily at 2 AM

### Build Configuration
- **Build Command**: `prisma generate && next build --webpack`
- **Output Directory**: `.next`
- **Install Command**: `npm install` (or `pnpm install`)

## Current Project Info
- **Project ID**: `prj_errdzu70SGjfvoGs9Vi5weGFC8gY`
- **Project Name**: `lifevault`
- **Root Directory**: `frontend` (if needed)

## Troubleshooting

### Build Failures
- Check build logs in Vercel Dashboard
- Ensure all environment variables are set
- Verify Prisma migrations are up to date

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check if database allows connections from Vercel IPs
- Ensure SSL mode is configured correctly

### Missing Dependencies
- Check `package.json` for all required dependencies
- Ensure `postinstall` script runs `prisma generate`

