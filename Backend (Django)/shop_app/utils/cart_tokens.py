import base64
import hashlib
import hmac
import json
import time
from django.conf import settings


def _b64u_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64u_decode(s: str) -> bytes:
    # add padding
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def make_cart_token(cart_code: str, expires_in: int = 3600, user_id: int | None = None) -> str:
    """Create an HMAC-signed cart token containing cart_code and expiry (unix ts).

    Token format: base64url(payload).hex_signature
    payload = json.dumps({"c": cart_code, "e": exp_ts}).encode('utf-8')
    signature = HMAC_SHA256(SECRET_KEY, payload)
    returns: <b64u(payload)>.<hexsig>
    """
    exp = int(time.time()) + int(expires_in)
    payload_data = {"c": cart_code, "e": exp, "u": user_id}
    payload = json.dumps(payload_data, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"{_b64u_encode(payload)}.{sig}"


def verify_cart_token(token: str) -> dict | None:
    """Verify token and return the decoded payload if valid and not expired, else None."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        payload = _b64u_decode(payload_b64)
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        # constant-time compare
        if not hmac.compare_digest(expected_sig, sig):
            return None
        data = json.loads(payload.decode("utf-8"))
        if int(time.time()) > int(data.get("e", 0)):
            return None
        return data
    except Exception:
        return None


def get_cart_code_from_request(request):
    """Return cart_code only from a validated cart token.

    Accepts `X-Cart-Token` or the `cart_token` query parameter. If the token is valid,
    returns the embedded cart_code; otherwise returns None.
    """
    query_params = getattr(request, "query_params", None) or getattr(request, "GET", None) or {}
    token = request.META.get("HTTP_X_CART_TOKEN") or query_params.get("cart_token")
    if not token:
        return None

    payload = getattr(request, "cart_token_payload", None)
    if not payload:
        payload = verify_cart_token(token)
        if payload:
            request.cart_token_payload = payload

    if not payload:
        return None

    token_cart_code = payload.get("c")
    token_user_id = payload.get("u")
    current_user = getattr(request, "user", None)
    current_user_id = current_user.id if getattr(current_user, "is_authenticated", False) else None
    if current_user_id is None:
        if token_user_id is not None:
            return None
    elif token_user_id != current_user_id:
        return None

    return token_cart_code
