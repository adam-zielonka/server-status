# Migration Guide - Security Updates

## Quick Start (Existing Users)

If you already have a running instance of server-status, follow these steps to apply the security updates:

### 1. Backup Your Current Config
```bash
cd api
cp config.jsonc config.jsonc.backup
```

### 2. Update Your Code
```bash
git pull origin main
# or download the latest version
```

### 3. Rebuild the Backend
```bash
cd api
go build -o build/status
```

### 4. No Config Changes Needed
Your existing `config.jsonc` will continue to work. The format hasn't changed.

### 5. Restart the Server
```bash
# Stop the old server (Ctrl+C or kill)
./build/status

# Or with graceful shutdown:
# Send SIGTERM and it will shutdown gracefully
```

### 6. Frontend Updates
```bash
cd app
pnpm install  # Update dependencies if needed
pnpm build    # Rebuild if using production build
```

## What Changed?

### Backend (Go API)
- ✅ JWT tokens now expire after 24 hours (automatic)
- ✅ Better security with proper token validation
- ✅ CORS support added (automatic)
- ✅ Graceful shutdown on Ctrl+C (automatic)
- ✅ Health endpoint at `/health` (automatic)
- ✅ Better error handling (automatic)

### Frontend (React App)
- ✅ More secure token storage (automatic)
- ✅ Better error handling (automatic)
- ✅ No breaking changes to UI

## Breaking Changes

**None!** All changes are backward compatible.

## New Features You Can Use

### 1. Public Health Endpoint
```bash
curl http://localhost:4000/health
# Returns: {"status":"ok"}
```

Use this for load balancer health checks without authentication.

### 2. Graceful Shutdown
The server now handles `SIGTERM` and `SIGINT` gracefully:
- Stops accepting new connections
- Completes in-flight requests (up to 30 seconds)
- Cleanly shuts down

### 3. Token Expiration
Tokens now expire after 24 hours. Users will need to re-authenticate automatically when their token expires.

## Optional: Update Your Config

While not required, you can add comments to your config using the example:

```bash
cd api
# Look at the new example file
cat config.jsonc.example

# Optionally update your config with better organization
```

## Testing After Update

### 1. Test Authentication
```bash
# Should work as before
curl -u your-username:your-password http://localhost:4000/api/auth
```

### 2. Test API Endpoints
```bash
# Get a token first
TOKEN=$(curl -s -u username:password http://localhost:4000/api/auth | jq -r '.data.token')

# Test an endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/system
```

### 3. Test Frontend
```bash
cd app
pnpm dev
# Open http://localhost:5173 (or configured port)
# Login should work as before
```

## Rollback (If Needed)

If you encounter issues:

```bash
# Restore your backup
cd api
cp config.jsonc.backup config.jsonc

# Use your previous binary
cp build/status.old build/status

# Or rebuild from previous version
git checkout <previous-version>
go build -o build/status
```

## Common Issues

### Issue: "Token expired" errors
**Cause:** You're using an old token after update
**Solution:** Re-authenticate to get a new token with expiration

### Issue: CORS errors in browser
**Cause:** Browser caching old responses
**Solution:** Clear browser cache or use Ctrl+Shift+R

### Issue: Frontend not connecting
**Cause:** API not running or wrong URL
**Solution:** Check API is running on correct port, verify VITE_API_URL

## Need Help?

Check the main README.md and SECURITY_IMPROVEMENTS.md for detailed information about all changes.

## Production Deployment Notes

Before deploying to production:

1. ✅ Generate a strong secret key:
   ```bash
   openssl rand -hex 32
   ```

2. ✅ Update CORS to allow only your frontend domain:
   Edit `api/status.go` line with `Access-Control-Allow-Origin`

3. ✅ Use HTTPS in production (reverse proxy recommended)

4. ✅ Set up proper monitoring and logging

5. ⚠️ Consider implementing password hashing (see SECURITY_IMPROVEMENTS.md)

## Timeline

- **Development/Testing:** Apply updates immediately
- **Staging:** Test for 24-48 hours
- **Production:** Deploy during maintenance window

## Support

For issues or questions:
1. Check SECURITY_IMPROVEMENTS.md
2. Review the code changes in git history
3. Open an issue on GitHub
