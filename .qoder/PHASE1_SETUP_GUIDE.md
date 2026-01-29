# Phase 1 Quick Setup Guide

This guide helps you set up and test the Phase 1 implementation.

## Prerequisites

- Python 3.11+
- PostgreSQL or SQLite
- Redis server
- Postal email server (or any SMTP server)
- OAuth applications registered (VK, Yandex, Telegram)

## 1. Database Migration

Run the database migration to create new tables:

```bash
cd backend
python3 -m alembic upgrade head
```

This will create:

- `email_verification_token` table
- `password_reset_token` table
- Add `email_verified` and `terms_accepted_at` columns to `user` table

## 2. Environment Configuration

Create or update your `.env` file with the following variables:

```bash
# OAuth Providers
ENABLE_OAUTH_SIGNUP=true
OAUTH_MERGE_ACCOUNTS_BY_EMAIL=false  # Set to true to allow account merging

# VK OAuth
VK_CLIENT_ID=your_vk_client_id
VK_CLIENT_SECRET=your_vk_client_secret
VK_REDIRECT_URI=http://localhost:3000/api/v1/oauth/vk/callback
VK_OAUTH_SCOPE=email
VK_API_VERSION=5.131

# Yandex OAuth
YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret
YANDEX_REDIRECT_URI=http://localhost:3000/api/v1/oauth/yandex/callback
YANDEX_OAUTH_SCOPE=login:email login:info login:avatar

# Telegram OAuth
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_NAME=your_bot_username
TELEGRAM_AUTH_ORIGIN=http://localhost:3000

# Email Service (Postal)
SMTP_HOST=smtp.postal.example.com
SMTP_PORT=25
SMTP_USERNAME=your_api_key
SMTP_PASSWORD=your_postal_secret
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Open WebUI

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Token Expiry Settings
EMAIL_VERIFICATION_EXPIRY_HOURS=24
PASSWORD_RESET_EXPIRY_HOURS=2

# Redis (required for OAuth state management)
REDIS_URL=redis://localhost:6379/0
```

## 3. OAuth Application Setup

### VK OAuth Setup

1. Go to https://vk.com/apps?act=manage
2. Create new standalone application
3. Settings → OAuth Settings:
   - Authorized redirect URI: `http://localhost:3000/api/v1/oauth/vk/callback`
   - Access to user settings: Email
4. Copy Application ID → `VK_CLIENT_ID`
5. Copy Secure key → `VK_CLIENT_SECRET`

### Yandex OAuth Setup

1. Go to https://oauth.yandex.ru/
2. Register new application
3. Platforms → Web services:
   - Callback URI: `http://localhost:3000/api/v1/oauth/yandex/callback`
4. Permissions:
   - Access to email address
   - Access to user info
   - Access to avatar
5. Copy ID → `YANDEX_CLIENT_ID`
6. Copy Password → `YANDEX_CLIENT_SECRET`

### Telegram Bot Setup

1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Create new bot: `/newbot`
3. Set domain: `/setdomain` → `yourdomain.com`
4. Copy bot token → `TELEGRAM_BOT_TOKEN`
5. Copy bot username → `TELEGRAM_BOT_NAME`

## 4. Email Service Setup (Postal)

### Option A: Use Postal Email Server

1. Install Postal: https://docs.postalserver.io/
2. Create organization and mail server
3. Generate API key
4. Configure SMTP credentials in `.env`

### Option B: Use Alternative SMTP (Gmail, Mailgun, etc.)

For Gmail (development only):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_USE_TLS=true
```

For Mailgun:

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@yourdomain.com
SMTP_PASSWORD=your-mailgun-password
SMTP_USE_TLS=true
```

## 5. Start the Application

```bash
# Start Redis (if not running)
redis-server

# Start backend
cd backend
python3 -m uvicorn open_webui.main:app --reload --host 0.0.0.0 --port 8080

# In another terminal, start frontend
cd frontend
npm run dev
```

## 6. Testing

### Test Email/Password Registration

1. Go to http://localhost:3000/auth
2. Click "Sign Up"
3. Fill in email, name, password
4. Click "Create Account"
5. Check email for verification link
6. Click verification link
7. Check email for welcome message

### Test VK OAuth

1. Go to http://localhost:3000/auth
2. Click "Login with VK" (you'll need to add this button to frontend)
3. Or visit: http://localhost:8080/api/v1/oauth/vk/login
4. Authorize the application
5. Should be redirected back and logged in
6. Check email for welcome message

### Test Yandex OAuth

1. Go to http://localhost:3000/auth
2. Click "Login with Yandex"
3. Or visit: http://localhost:8080/api/v1/oauth/yandex/login
4. Authorize the application
5. Should be redirected back and logged in
6. Check email for welcome message

### Test Telegram OAuth

Frontend implementation needed. The widget should:

```html
<script
	async
	src="https://telegram.org/js/telegram-widget.js?22"
	data-telegram-login="YOUR_BOT_NAME"
	data-size="large"
	data-onauth="onTelegramAuth(user)"
	data-request-access="write"
></script>

<script>
	function onTelegramAuth(user) {
		// Send to backend
		fetch('/api/v1/oauth/telegram/callback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(user)
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.requires_email) {
					// Show email collection form
					showEmailForm(data.temp_session);
				} else {
					// Login successful
					setAuthToken(data.token);
				}
			});
	}

	function submitEmail(tempSession, email, termsAccepted) {
		fetch('/api/v1/oauth/telegram/complete-profile', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				temp_session: tempSession,
				email: email,
				terms_accepted: termsAccepted
			})
		})
			.then((res) => res.json())
			.then((data) => {
				setAuthToken(data.token);
				// Check email for verification link
			});
	}
</script>
```

### Test Password Reset

1. Go to password reset page
2. Enter email address
3. Click "Reset Password"
4. Check email for reset link
5. Click reset link
6. Enter new password
7. Submit
8. Check email for confirmation

### Test Email Verification Resend

```bash
curl -X POST http://localhost:8080/api/v1/auths/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## 7. Verify Database Records

```sql
-- Check email verification tokens
SELECT * FROM email_verification_token;

-- Check password reset tokens
SELECT * FROM password_reset_token;

-- Check user email_verified status
SELECT id, email, email_verified, terms_accepted_at FROM "user";

-- Check OAuth linkage
SELECT id, email, name, oauth FROM "user" WHERE oauth IS NOT NULL;
```

## 8. Check Logs

Look for log entries confirming:

- Email sent successfully
- OAuth callback received
- State token validated
- User created
- Terms acceptance recorded
- Email verification status updated

```bash
# Backend logs
tail -f backend/logs/app.log

# Or if using docker
docker logs -f open-webui-backend
```

## 9. Test Rate Limiting

Try to trigger rate limits:

```bash
# Email verification (3 per hour)
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/v1/auths/resend-verification \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}'
  echo ""
done

# Should get 429 Too Many Requests after 3 attempts
```

## 10. Common Issues

### Issue: Email not sending

**Solution**:

- Check SMTP credentials in `.env`
- Verify SMTP server is reachable
- Check backend logs for SMTP errors
- Try `telnet smtp.example.com 587` to test connectivity

### Issue: OAuth redirect not working

**Solution**:

- Verify redirect URI matches exactly in OAuth provider settings
- Check that `VK_REDIRECT_URI` / `YANDEX_REDIRECT_URI` / `TELEGRAM_AUTH_ORIGIN` are correct
- Ensure no trailing slashes in URLs

### Issue: State token validation failed

**Solution**:

- Ensure Redis is running
- Check `REDIS_URL` in `.env`
- Verify Redis connection in backend logs

### Issue: Telegram signature verification failed

**Solution**:

- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check that auth_date is recent (within 24 hours)
- Ensure all Telegram data is passed correctly

### Issue: Migration fails

**Solution**:

```bash
# Reset migration (development only!)
python3 -m alembic downgrade -1
python3 -m alembic upgrade head

# Or create new migration
python3 -m alembic revision --autogenerate -m "add email verification"
python3 -m alembic upgrade head
```

## 11. Production Deployment

Before deploying to production:

1. ✅ Change all URLs from `localhost` to production domain
2. ✅ Use production SMTP server (not Gmail)
3. ✅ Enable HTTPS for all OAuth callbacks
4. ✅ Set `WEBUI_AUTH_COOKIE_SECURE=true`
5. ✅ Use strong Redis password
6. ✅ Set `OAUTH_MERGE_ACCOUNTS_BY_EMAIL=false` (for security)
7. ✅ Configure proper CORS settings
8. ✅ Set up monitoring and logging
9. ✅ Test all OAuth flows end-to-end
10. ✅ Test email delivery to multiple providers

## 12. Monitoring

Key metrics to monitor:

- OAuth conversion rate (successful logins / attempts)
- Email delivery rate
- Email verification rate
- Password reset completion rate
- Rate limit hits
- Redis connection errors
- SMTP errors

## Next Steps

Once Phase 1 is fully tested and deployed:

- Implement Phase 2: Public landing page
- Add OAuth buttons to frontend
- Implement YooKassa payment integration
- Create pricing page
- Add user onboarding flow

---

**Need Help?**

Check the logs in `.qoder/` directory for detailed implementation notes:

- `PHASE1_COMPLETION_SUMMARY.md` - Full implementation details
- `implementation-summary.md` - Earlier progress report
- `RUSSIAN_OAUTH_SETUP.md` - OAuth provider setup guide
