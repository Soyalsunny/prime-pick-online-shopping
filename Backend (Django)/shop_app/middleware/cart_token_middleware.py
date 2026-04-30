import logging

from django.utils.deprecation import MiddlewareMixin

from ..utils.cart_tokens import verify_cart_token


security_logger = logging.getLogger("security_audit")


class CartTokenMiddleware(MiddlewareMixin):
    """Middleware to accept a signed cart token and inject `cart_code` into the request.

    Supports:
    - `X-Cart-Token` header
    - `cart_token` query parameter

    If a valid token is found, the middleware stores the decoded payload on the request
    so downstream helpers can validate ownership against the authenticated user.
    """

    def process_request(self, request):
        token = request.META.get("HTTP_X_CART_TOKEN") or request.GET.get("cart_token")
        if not token:
            return None

        cart_code = verify_cart_token(token)
        if not cart_code:
            security_logger.info(
                "invalid_cart_token path=%s ip=%s ua=%s",
                request.path,
                request.META.get("REMOTE_ADDR", "unknown"),
                request.META.get("HTTP_USER_AGENT", "unknown"),
            )
            return None

        # attach decoded payload for downstream code to use
        request.cart_token_payload = cart_code

        return None
