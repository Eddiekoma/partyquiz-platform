# PartyQuiz Web App - Coolify Environment Variables

## 🔐 Required Variables

NODE_ENV=production

# Database (Internal Coolify URL)
DATABASE_URL=postgres://postgres:A9HUDZdJWzpTTchdvktLmLA8VoqCo1mMPjpyuBNu1MDhHH8E3XEnLCzqCA0lHe3H@r00oss4cggks40c48c0kg8o8:5432/postgres

# Redis (Internal Coolify URL)
REDIS_URL=redis://default:rukO6osWHCq3KxfKcfPraKG4mV7vqFvjctZ0Hqi71uWdzXh5g5B6G83GyCBYUBTr@zwgsko8kc4kg4csgg440co08:6379/0

# Auth (Generate new: openssl rand -base64 32)
NEXTAUTH_SECRET=GENERATE_A_NEW_SECRET_HERE
NEXTAUTH_URL=https://partyquiz.databridge360.com

# Application URLs
APP_BASE_URL=https://partyquiz.databridge360.com
WS_BASE_URL=wss://partyquiz.databridge360.com

# S3 Storage (Optional - voor media uploads)
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=eu-central-1
S3_BUCKET=partyquiz-media
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Spotify API (Optional)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://partyquiz.databridge360.com/api/auth/spotify/callback

# YouTube API (Optional)
YOUTUBE_API_KEY=

# Email (Optional - voor magic links)
EMAIL_SMTP_HOST=smtp.ethereal.email
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=
EMAIL_FROM=noreply@partyquiz.databridge360.com
