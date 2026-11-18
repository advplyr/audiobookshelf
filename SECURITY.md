# Security

Report security issues through GitHub private vulnerability reporting.

Failed logins (`POST /login`) share one server-wide limit. Failed password changes (`PATCH /api/me/password`) are limited per user. Neither limit uses the client IP. Set `RATE_LIMIT_AUTH_MAX=0` to disable both.

Anything beyond those two limits is the server operator's responsibility. Add a rate limiter in front of the server if you want one. A missing limiter on any other route is out of scope unless the report shows a guessable secret or a resource that grows without a bound.
