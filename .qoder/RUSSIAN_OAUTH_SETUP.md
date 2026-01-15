# Quick Setup Guide: Russian OAuth Integration

This guide will help you set up VK, Yandex, and Telegram OAuth for the Russian market.

## Prerequisites

- Open WebUI instance running
- Domain name configured (e.g., `yourdomain.com`)
- HTTPS enabled (required for OAuth callbacks)
- Redis running (for state management)
- Postal email service (optional, for email verification)

---

## Step 1: Register OAuth Applications

### VK (ВКонтакте)

1. **Create Application:**
   - Go to: https://vk.com/apps?act=manage
   - Click "Create Application"
   - Choose "Standalone application"
   - Fill in application name and details

2. **Configure Settings:**
   - Navigate to "Settings" section
   - Add **Redirect URI**: `https://yourdomain.com/api/v1/oauth/vk/callback`
   - Enable "Access to email" permission
   - Submit and wait for moderation (usually instant for Redirect URI)

3. **Get Credentials:**
   - Copy **App ID** → This is your `VK_CLIENT_ID`
   - Copy **Secure key** → This is your `VK_CLIENT_SECRET`

### Yandex

1. **Register Application:**
   - Go to: https://oauth.yandex.ru/
   - Click "Register new application"
   - Fill in application name

2. **Configure Permissions:**
   - Select platform: **Web services**
   - Add **Callback URI**: `https://yourdomain.com/api/v1/oauth/yandex/callback`
   - Select scopes:
     - ✅ Email address
     - ✅ User info
     - ✅ Avatar

3. **Get Credentials:**
   - Copy **Client ID** → This is your `YANDEX_CLIENT_ID`
   - Copy **Client secret** → This is your `YANDEX_CLIENT_SECRET`

### Telegram

1. **Create Bot:**
   - Open Telegram app
   - Search for `@BotFather`
   - Send command: `/newbot`
   - Follow prompts:
     - Choose bot name (e.g., "My Service Auth Bot")
     - Choose username (e.g., "myservice_auth_bot")
   
2. **Configure Domain:**
   - Send command to BotFather: `/setdomain`
   - Select your bot from the list
   - Enter your domain: `yourdomain.com`
   - Confirm

3. **Get Credentials:**
   - Copy the **bot token** from BotFather → This is your `TELEGRAM_BOT_TOKEN`
   - Copy the **bot username** → This is your `TELEGRAM_BOT_NAME`

---

## Step 2: Configure Environment Variables

Add these to your `.env` file:

```bash
# VK OAuth
VK_CLIENT_ID=your_app_id_from_vk
VK_CLIENT_SECRET=your_secure_key_from_vk
VK_REDIRECT_URI=https://yourdomain.com/api/v1/oauth/vk/callback
VK_OAUTH_SCOPE=email
VK_API_VERSION=5.131

# Yandex OAuth
YANDEX_CLIENT_ID=your_client_id_from_yandex
YANDEX_CLIENT_SECRET=your_client_secret_from_yandex
YANDEX_REDIRECT_URI=https://yourdomain.com/api/v1/oauth/yandex/callback
YANDEX_OAUTH_SCOPE=login:email login:info login:avatar

# Telegram OAuth
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_BOT_NAME=myservice_auth_bot
TELEGRAM_AUTH_ORIGIN=https://yourdomain.com

# OAuth Settings
ENABLE_OAUTH_SIGNUP=true
OAUTH_MERGE_ACCOUNTS_BY_EMAIL=true
```

**Important Notes:**
- Replace `yourdomain.com` with your actual domain
- Replace placeholder credentials with real values from Step 1
- Ensure `ENABLE_OAUTH_SIGNUP=true` to enable OAuth functionality
- Set `OAUTH_MERGE_ACCOUNTS_BY_EMAIL=true` to allow account merging

---

## Step 3: Run Database Migration

```bash
cd backend
alembic upgrade head
```

This creates:
- `email_verification_token` table
- `password_reset_token` table
- Adds `email_verified` and `terms_accepted_at` columns to user table

---

## Step 4: Restart Application

```bash
# Stop current instance
# Start with new environment variables loaded
docker-compose restart
# OR
python backend/open_webui/main.py
```

---

## Step 5: Test OAuth Flows

### Test VK OAuth:

1. Navigate to: `https://yourdomain.com/api/v1/oauth/vk/login`
2. Should redirect to VK authorization page
3. Click "Allow" (Разрешить)
4. Should redirect back to your app
5. Should be logged in with VK account

### Test Yandex OAuth:

1. Navigate to: `https://yourdomain.com/api/v1/oauth/yandex/login`
2. Should redirect to Yandex authorization page
3. Click "Allow" (Разрешить)
4. Should redirect back to your app
5. Should be logged in with Yandex account

### Test Telegram OAuth (requires frontend widget):

Add widget to your auth page:

```html
<script 
  async 
  src="https://telegram.org/js/telegram-widget.js?22" 
  data-telegram-login="your_bot_username" 
  data-size="large" 
  data-onauth="onTelegramAuth(user)" 
  data-request-access="write">
</script>

<script>
  function onTelegramAuth(user) {
    fetch('/api/v1/oauth/telegram/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    })
    .then(res => res.json())
    .then(data => {
      if (data.requires_email) {
        // Show email collection form
        showEmailForm(data.temp_session);
      } else {
        // User already has account, set token
        setToken(data.token);
        window.location.href = '/home';
      }
    });
  }
</script>
```

---

## Troubleshooting

### VK OAuth

**Issue:** "Invalid redirect_uri"
- **Solution:** Ensure Redirect URI in VK app settings exactly matches: `https://yourdomain.com/api/v1/oauth/vk/callback`
- Check for trailing slashes (should not have one)
- Ensure HTTPS is used

**Issue:** "Email not provided"
- **Solution:** Enable "Access to email" permission in VK app settings
- User must grant email permission during authorization

### Yandex OAuth

**Issue:** "Invalid client_id or client_secret"
- **Solution:** Double-check credentials in `.env` file
- Ensure no extra spaces or newlines

**Issue:** "Callback URL mismatch"
- **Solution:** Verify callback URL in Yandex app exactly matches environment variable

### Telegram OAuth

**Issue:** "Invalid hash"
- **Solution:** Ensure `TELEGRAM_BOT_TOKEN` is correct
- Check that widget is using correct bot username
- Verify `data-telegram-login` matches `TELEGRAM_BOT_NAME`

**Issue:** "Domain not set"
- **Solution:** Use `/setdomain` command in BotFather
- Domain must match your application's domain (no protocol, no port)

### General Issues

**Issue:** "OAuth signup is disabled"
- **Solution:** Set `ENABLE_OAUTH_SIGNUP=true` in `.env`

**Issue:** "State token invalid"
- **Solution:** 
  - Ensure Redis is running
  - Check Redis connection in application logs
  - State tokens expire in 5 minutes

**Issue:** "CSRF attack detected"
- **Solution:** 
  - Clear browser cookies
  - Ensure system time is correct (for Redis expiration)
  - Try incognito/private browsing mode

---

## Security Checklist

- [ ] HTTPS enabled on your domain
- [ ] Redirect URIs exactly match OAuth app settings
- [ ] Bot domain set correctly in BotFather
- [ ] `ENABLE_OAUTH_SIGNUP=true` set intentionally
- [ ] Strong `VK_CLIENT_SECRET` and `YANDEX_CLIENT_SECRET` (never commit to git)
- [ ] `TELEGRAM_BOT_TOKEN` kept private (never expose in frontend)
- [ ] Redis configured for state management
- [ ] Secure cookies enabled (`WEBUI_AUTH_COOKIE_SECURE=true` in production)

---

## Frontend Integration

Add OAuth buttons to your auth page:

```html
<!-- VK Button -->
<a href="/api/v1/oauth/vk/login" class="btn btn-vk">
  <svg><!-- VK icon --></svg>
  <span>Войти через ВКонтакте</span>
</a>

<!-- Yandex Button -->
<a href="/api/v1/oauth/yandex/login" class="btn btn-yandex">
  <svg><!-- Yandex icon --></svg>
  <span>Войти через Яндекс</span>
</a>

<!-- Telegram Widget (see Test section above) -->
```

**Styling Recommendations:**
- VK brand color: `#0077FF` (blue)
- Yandex brand color: `#FC3F1D` (red)
- Telegram brand color: `#0088CC` (blue)
- Use official brand icons
- Make buttons prominent (Russian users prefer OAuth over email/password)

---

## Next Steps

After OAuth is working:

1. **Implement Email Verification:**
   - Configure Postal SMTP
   - Create email templates
   - Send verification emails to Telegram users

2. **Add Landing Page:**
   - Show OAuth buttons prominently
   - Russian language interface
   - Mobile-responsive design

3. **Configure Billing:**
   - Assign free plan to new OAuth users
   - YooKassa integration (already exists)

4. **Monitor Usage:**
   - Track OAuth registration sources
   - Monitor error rates
   - Set up alerts for OAuth failures

---

## Support

**OAuth Provider Documentation:**
- VK API: https://dev.vk.com/ru/api/oauth/overview
- Yandex OAuth: https://yandex.ru/dev/id/doc/ru/
- Telegram Login Widget: https://core.telegram.org/widgets/login

**Implementation Details:**
- See: `.qoder/implementation-summary.md`
- Code: `backend/open_webui/routers/oauth_russian.py`
- Config: `backend/open_webui/config.py`

---

**Last Updated:** December 17, 2024
