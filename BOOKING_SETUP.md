# LifeScore Booking Setup

Live consultation booking stays unavailable until the production environment has storage and email configured.

Add these environment variables in Vercel:

```txt
KV_REST_API_URL or UPSTASH_REDIS_REST_URL
KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY
LIFESCORE_FROM_EMAIL
LIFESCORE_ADMIN_EMAIL=may23@fsu.edu
```

Setup steps:

1. Go to Vercel -> Project -> Settings -> Environment Variables.
2. Add the variables above for Production.
3. Redeploy the project.
4. Test `/api/consultation-slots`.
5. Test booking through Score.

Do not fake bookings. Until these variables are set, Score should honestly say scheduling is not enabled yet.
