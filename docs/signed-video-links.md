# Signed video links: staged deployment

Status: Beta backend and Beta website player use signed links.
**Not enforced on public Nginx, Production or tvOS.**

## Existing infrastructure

- NAS compose: `/volume1/docker/project1337-media/docker-compose.yaml`
- Container: `project1337-media`, `nginx:alpine`, host port `8080:80`
- Read-only files: `/volume1/1337` mounted at `/usr/share/nginx/html`
- `video.my1337.de` reaches the container through Cloudflare Tunnel.
- Current Nginx `location /` serves files without authentication.

## Beta API

`GET /api/video-link/:movieId` requires the signed website session cookie,
looks up `movies.file_url` on the server, and returns a signed URL that expires
after four hours. The endpoint returns `401` without the cookie; `503` until
`VIDEO_SIGNING_SECRET` is configured. The response is never cached.

Signatures follow Nginx's `secure_link_md5`: URL-safe Base64 MD5 of
`<expires><decoded-normalized-uri> <secret>`. Only URLs on
`https://video.my1337.de` are accepted.

## Cutover checklist — separate approval required

1. Generate a strong random secret and configure the **same** value as
   `VIDEO_SIGNING_SECRET` in the desired Vercel environment and in a NAS-only
   Nginx configuration. Never commit the value to Git. Redeploy after changing
   the Vercel environment variable.
2. Test signatures in an isolated Nginx instance using representative paths:
   ordinary names, spaces, Unicode, and HTTP `Range` requests. Verify valid
   signatures return `200/206`, missing/wrong signatures `403`, expired `410`.
3. The Beta website player now requests the protected endpoint and
   **fails closed** when it cannot obtain a signature. Verify browser playback,
   refresh and seeking manually. Update and test the **regular** tvOS client, too: its existing
   implementation currently uses direct media URLs, and app releases may lag.
4. Back up the NAS Compose and Nginx configuration. Mount the custom Nginx
   config read-only in Compose. Validate with `nginx -t` and test the new
   configuration in parallel before switching public traffic. Preserve the
   existing read-only media mount and HTTP byte-range support.
5. After both clients are confirmed compatible, enable enforcement on the
   public media endpoint. Confirm a bare old URL is rejected, signed URLs play,
   and no alternate path exposes port 8080 publicly. Ensure CDN caching cannot
   bypass signature validation.
6. Monitor errors and retain a short rollback window. Rolling back Nginx
   enforcement restores old playback but also restores public media access;
   treat that rollback as a temporary security exception.

Suggested Nginx location **template only** (replace the placeholder securely):

```nginx
location / {
    root /usr/share/nginx/html;
    secure_link $arg_md5,$arg_expires;
    secure_link_md5 "$secure_link_expires$uri YOUR_SERVER_ONLY_SECRET";
    if ($secure_link = "") { return 403; }
    if ($secure_link = "0") { return 410; }
    add_header Cache-Control "private, no-store" always;
}
```

Do **not** deploy this configuration yet: it would immediately break clients
that request unsigned URLs. Also review any separate Cloudflare route/cache
rules before enforcement.
