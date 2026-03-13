# Call Center Backend

Next.js + TypeScript backend for the `CallCenterApp` mobile client.

## Stack

- Next.js App Router for REST APIs
- Prisma + PostgreSQL
- Socket.IO for direct, group, and broadcast messaging
- Dev identity via `x-user-id`

## Quick start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Dev identity

For v1, pass `x-user-id` with the ID of a seeded user. The server resolves role and permissions from the database.

## Major endpoints

- `GET /api/dashboard/summary`
- `GET/POST /api/users`
- `GET/POST /api/activity-reports`
- `GET/POST /api/contacts`
- `GET/POST /api/feedback-items`
- `GET/POST /api/scripts`
- `GET /api/scripts/current`
- `GET/POST /api/goals`
- `GET /api/leaderboard?week=2026-W11`
- `GET/POST /api/messages/threads`
- `GET/POST /api/broadcasts`
- `GET /api/admin/activity`
- `GET /api/admin/metrics`

## Socket events

- `message.created`
- `broadcast.created`
- `goal.updated`

Clients should connect to `/socket.io` and join rooms using:

- `user:{userId}`
- `group:{groupId}`
- `org`
