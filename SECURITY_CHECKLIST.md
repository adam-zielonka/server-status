# Security Checklist

Use this checklist before deploying to production.

## ✅ Pre-Deployment Security Checklist

### Configuration
- [ ] Strong secret key generated (min 32 characters, random)
- [ ] Default credentials changed
- [ ] `config.jsonc` added to `.gitignore`
- [ ] No credentials committed to git repository
- [ ] Config file permissions set to 600 (owner read/write only)

### Authentication & Authorization
- [x] JWT tokens have expiration (24 hours)
- [x] Rate limiting on auth endpoint (5 attempts per minute)
- [ ] Consider implementing password hashing (bcrypt/argon2)
- [ ] Review user list - remove test/demo accounts
- [ ] Strong passwords enforced (min 12 characters recommended)

### Network Security
- [x] CORS configured (update for production domain)
- [ ] HTTPS enabled (use reverse proxy like Caddy/Nginx)
- [ ] Firewall rules configured
- [ ] API only accessible through reverse proxy
- [x] Request timeouts configured (15s)
- [x] Idle timeout configured (60s)

### TLS/SSL
- [ ] Valid SSL certificates installed
- [ ] TLS 1.2 or higher enforced
- [x] Certificate validation warnings reviewed (vhosts.go)
- [ ] HSTS header configured (in reverse proxy)

### Monitoring & Logging
- [ ] Logging configured and tested
- [ ] Log rotation configured
- [ ] Monitoring alerts set up
- [x] Health endpoint working (`/health`)
- [ ] Failed login attempts monitored
- [ ] Error tracking implemented

### Application Security
- [x] Frontend token exposure limited (dev only)
- [x] Generic error messages (no information disclosure)
- [x] Input validation on config loading
- [x] Race conditions prevented (sync.Once)
- [x] Graceful shutdown implemented

### Infrastructure
- [ ] Server OS updated and patched
- [ ] Unnecessary services disabled
- [ ] Regular backup strategy in place
- [ ] Disaster recovery plan documented
- [ ] Non-root user running the application

### Code Quality
- [x] No hardcoded credentials in code
- [x] Constants used for magic numbers
- [x] Proper error handling
- [x] Code reviewed for security issues
- [ ] Dependencies updated to latest versions
- [ ] Security scanning performed (go vet, npm audit)

### Documentation
- [x] Configuration example provided
- [x] Security improvements documented
- [ ] Deployment procedures documented
- [ ] Incident response plan created
- [ ] Contact information for security issues

## 🔴 Critical (Must Do)

These items are CRITICAL and must be completed before production:

1. **Change Default Credentials**
   ```bash
   # Update config.jsonc with unique username/password
   nano api/config.jsonc
   ```

2. **Generate Strong Secret**
   ```bash
   # Generate and update in config.jsonc
   openssl rand -hex 32
   ```

3. **Enable HTTPS**
   ```nginx
   # Example Nginx config
   server {
       listen 443 ssl http2;
       server_name status.yourdomain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:4000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $remote_addr;
       }
   }
   ```

4. **Update CORS**
   ```go
   // In api/status.go, update CORS middleware:
   w.Header().Set("Access-Control-Allow-Origin", "https://yourdomain.com")
   ```

5. **File Permissions**
   ```bash
   chmod 600 api/config.jsonc
   chmod 700 api/build/status
   ```

## 🟡 High Priority (Should Do)

1. **Implement Password Hashing**
   - Use bcrypt for password storage
   - Requires code changes in `config/config.go` and `auth/auth.go`

2. **Set Up Monitoring**
   ```bash
   # Example: systemd service
   sudo nano /etc/systemd/system/server-status.service
   ```

3. **Configure Log Rotation**
   ```bash
   # Example logrotate config
   /var/log/server-status/*.log {
       daily
       rotate 7
       compress
       delaycompress
       missingok
       notifempty
   }
   ```

4. **Regular Security Audits**
   ```bash
   # Go security check
   go vet ./...
   
   # Dependency audit
   npm audit
   go list -m -u all
   ```

## 🟢 Recommended (Nice to Have)

1. **Implement Structured Logging**
   - Replace fmt.Printf with proper logging library
   - Suggested: zap or logrus

2. **Add Request ID Tracing**
   - Track requests across logs
   - Helpful for debugging

3. **Implement Metrics**
   - Prometheus metrics endpoint
   - Track request counts, latencies, errors

4. **Add Integration Tests**
   - Test authentication flow
   - Test API endpoints
   - Test error handling

5. **Set Up CI/CD**
   - Automated testing
   - Security scanning
   - Automated deployment

## Testing Commands

### Security Testing

```bash
# 1. Test auth rate limiting
for i in {1..10}; do
  curl -u wrong:credentials http://localhost:4000/api/auth
done
# Should see "Too many attempts" after 5 tries

# 2. Test JWT expiration (requires modifying tokenExpiration to 1 minute for testing)
TOKEN=$(curl -s -u user:pass http://localhost:4000/api/auth | jq -r '.data.token')
sleep 61
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/system
# Should fail after expiration

# 3. Test CORS
curl -H "Origin: http://evil.com" -I http://localhost:4000/api/auth
# Check for CORS headers

# 4. Test health endpoint (no auth)
curl http://localhost:4000/health
# Should work without token

# 5. Test graceful shutdown
./build/status &
PID=$!
# Make some requests
curl http://localhost:4000/health
kill -TERM $PID
# Should see graceful shutdown message
```

### Dependency Security

```bash
# Backend
cd api
go list -m -u all  # Check for updates
go vet ./...       # Static analysis

# Frontend
cd app
npm audit          # Check for vulnerabilities
pnpm update        # Update dependencies
```

## Post-Deployment Verification

After deploying to production:

- [ ] Health endpoint accessible
- [ ] Authentication working
- [ ] HTTPS enforced
- [ ] CORS working from frontend domain
- [ ] API responses include proper headers
- [ ] Logs being written correctly
- [ ] Graceful shutdown tested
- [ ] Monitoring alerts working
- [ ] Backup system verified

## Security Incident Response

If you suspect a security breach:

1. **Immediate Actions:**
   - Rotate the JWT secret key
   - Force all users to re-authenticate
   - Review access logs
   - Block suspicious IPs

2. **Investigation:**
   - Check server logs for unusual activity
   - Review failed authentication attempts
   - Check for unauthorized configuration changes

3. **Recovery:**
   - Update credentials
   - Apply security patches
   - Notify users if necessary
   - Document incident

## Regular Maintenance

### Weekly
- [ ] Review application logs
- [ ] Check for failed auth attempts
- [ ] Verify backups

### Monthly
- [ ] Update dependencies (after testing)
- [ ] Review security advisories
- [ ] Test disaster recovery

### Quarterly
- [ ] Full security audit
- [ ] Update documentation
- [ ] Review and update incident response plan

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Go Security Checklist](https://github.com/Checkmarx/Go-SCP)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

## Contact

For security issues, please contact: [your-security-email@domain.com]

---

**Last Updated:** 2025-12-31
**Version:** 2.0 (with security improvements)
