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


def make_cart_token(cart_code: str, expires_in: int = 3600) -> str:
    """Create an HMAC-signed cart token containing cart_code and expiry (unix ts).

    Token format: base64url(payload).hex_signature
    payload = json.dumps({"c": cart_code, "e": exp_ts}).encode('utf-8')
    signature = HMAC_SHA256(SECRET_KEY, payload)
    returns: <b64u(payload)>.<hexsig>
    """
    exp = int(time.time()) + int(expires_in)
    payload = json.dumps({"c": cart_code, "e": exp}, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"{_b64u_encode(payload)}.{sig}"


def verify_cart_token(token: str) -> str | None:
    """Verify token and return cart_code if valid and not expired, else None."""
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
        return data.get("c")
    except Exception:
        return None


def get_cart_code_from_request(request):
    """Return cart_code only from a validated cart token.

    Accepts `X-Cart-Token` or the `cart_token` query parameter. If the token is valid,
    returns the embedded cart_code; otherwise returns None.
    """
    # prefer attribute set by middleware
    if hasattr(request, "cart_code") and request.cart_code:
        return request.cart_code

    # header
    token = request.META.get("HTTP_X_CART_TOKEN") or request.query_params.get("cart_token")
    if token:
        cart_code = verify_cart_token(token)
        if cart_code:
            return cart_code

    return None
