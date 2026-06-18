# LifeScore Deployment + Booking Setup

LifeScore is safe to upload to GitHub as long as secrets stay out of the repo. Add production credentials only in:

`Vercel Dashboard -> Project -> Settings -> Environment Variables`

Do not commit API keys, Redis/KV tokens, Resend keys, or `.env` files to GitHub.

## Required Vercel Environment Variables

Score live AI:

```txt
OPENAI_API_KEY
```

Consultation booking storage:

```txt
KV_REST_API_URL
KV_REST_API_TOKEN
```

or:

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Consultation confirmation email:

```txt
RESEND_API_KEY
LIFESCORE_FROM_EMAIL
LIFESCORE_ADMIN_EMAIL
```

Optional:

```txt
LIFESCORE_ADVISOR_EMAILS
OPENAI_MODEL
```

Redeploy after adding or changing environment variables.

## Booking Behavior

Booking should not fake success. If storage or email environment variables are missing, Score should say scheduling is not enabled yet instead of reserving a slot.

When everything is configured, booking uses:

- `/api/consultation-slots` to load open times
- `/api/book-consultation` to reserve a slot
- Redis/KV to prevent double booking
- Resend to email the user and LifeScore admin

## Local Testing Notes

Opening `index.html` directly as `file://` can show the frontend, including the favicon, but it cannot fully test `/api/...` routes.

Use deployed Vercel or `vercel dev` from the project root to test:

- Score chatbot live API responses
- consultation slot loading
- booking confirmation
- missing-env fallback behavior

## Deployment Checklist

1. Push the project to GitHub.
2. Import the GitHub repo into Vercel.
3. Add the required environment variables in Vercel.
4. Redeploy the project.
5. Test `/api/score-chat`.
6. Test `/api/consultation-slots`.
7. Test booking through Score.
8. Check Vercel Deployment Logs if an API fails.
