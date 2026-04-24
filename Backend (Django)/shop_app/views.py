from io import BytesIO
import logging
import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings as django_settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from django.http import FileResponse
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle
import stripe
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .models import (
    Cart,
    CartItem,
    EmailOTP,
    Order,
    OrderItem,
    PaymentTransaction,
    PaymentWebhookEvent,
    Product,
    ShippingAddress,
)
from .serializers import (
    CartItemSerializer,
    CartSerializer,
    ChangePasswordSerializer,
    DetailedProductSerializer,
    OrderSerializer,
    PasswordResetConfirmSerializer,
    ProductSerializer,
    ShippingAddressSerializer,
    SimpleCartSerializer,
    UserSerializer,
)

User = get_user_model()
security_logger = logging.getLogger("security_audit")

MAX_OTP_ATTEMPTS = 5
MAX_CART_ITEM_QTY = 20


class OTPRequestThrottle(ScopedRateThrottle):
    scope = "otp_request"


class OTPVerifyThrottle(ScopedRateThrottle):
    scope = "otp_verify"


class RegisterThrottle(ScopedRateThrottle):
    scope = "register"


class PaymentCreateThrottle(ScopedRateThrottle):
    scope = "payment_create"


class PublicReadThrottle(ScopedRateThrottle):
    scope = "public_read"


class CartWriteThrottle(ScopedRateThrottle):
    scope = "cart_write"


def _audit_event(event, request, user=None, status_text="success", details=None):
    actor = user.username if user else "anonymous"
    ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
    extra = f" details={details}" if details else ""
    security_logger.info("event=%s status=%s actor=%s ip=%s%s", event, status_text, actor, ip, extra)


def _generate_otp_code():
    return f"{random.randint(100000, 999999)}"


def _set_user_email_otp(user):
    otp_code = _generate_otp_code()
    expires_at = timezone.now() + timedelta(minutes=django_settings.EMAIL_OTP_EXPIRE_MINUTES)

    otp_record, _ = EmailOTP.objects.update_or_create(
        user=user,
        defaults={
            "otp_code": make_password(otp_code),
            "expires_at": expires_at,
            "is_verified": False,
            "failed_attempts": 0,
            "lockout_until": None,
        },
    )
    return otp_record, otp_code


def _send_registration_otp_email(user, otp_code):
    subject = "Prime Pick Email Verification OTP"
    message = (
        f"Hi {user.username},\n\n"
        f"Your Prime Pick verification OTP is: {otp_code}\n"
        f"This OTP expires in {django_settings.EMAIL_OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If you did not create this account, please ignore this email.\n"
    )

    send_mail(
        subject,
        message,
        django_settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def _send_login_otp_email(user, otp_code):
    subject = "Prime Pick Login OTP"
    message = (
        f"Hi {user.username},\n\n"
        f"Your Prime Pick login OTP is: {otp_code}\n"
        f"This OTP expires in {django_settings.EMAIL_OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If this wasn't you, please reset your password immediately.\n"
    )

    send_mail(
        subject,
        message,
        django_settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def _send_password_reset_otp_email(user, otp_code):
    subject = "Prime Pick Password Reset OTP"
    message = (
        f"Hi {user.username},\n\n"
        f"Your Prime Pick password reset OTP is: {otp_code}\n"
        f"This OTP expires in {django_settings.EMAIL_OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If you did not request a password reset, please ignore this email.\n"
    )

    send_mail(
        subject,
        message,
        django_settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def _email_send_error_response(default_message):
    return Response(
        {"error": default_message},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _generate_cart_code():
    return uuid.uuid4().hex[:10].upper()


def _get_or_create_user_cart(user):
    user_cart = Cart.objects.filter(user=user, paid=False).order_by("-id").first()
    if user_cart:
        return user_cart

    new_cart_code = _generate_cart_code()
    while Cart.objects.filter(cart_code=new_cart_code, paid=False).exists():
        new_cart_code = _generate_cart_code()

    return Cart.objects.create(cart_code=new_cart_code, user=user, paid=False)


def _merge_guest_cart_into_user_cart(user, guest_cart_code):
    if not guest_cart_code:
        return _get_or_create_user_cart(user)

    guest_cart = Cart.objects.filter(cart_code=guest_cart_code, paid=False).first()
    user_cart = Cart.objects.filter(user=user, paid=False).order_by("-id").first()

    if not guest_cart:
        return user_cart or _get_or_create_user_cart(user)

    if guest_cart.user and guest_cart.user != user:
        return user_cart or _get_or_create_user_cart(user)

    if user_cart and user_cart.id == guest_cart.id:
        return user_cart

    with transaction.atomic():
        if not user_cart:
            guest_cart.user = user
            guest_cart.save(update_fields=["user"])
            return guest_cart

        for guest_item in guest_cart.items.select_related("product").all():
            existing_item = CartItem.objects.filter(cart=user_cart, product=guest_item.product).first()
            if existing_item:
                existing_item.quantity += guest_item.quantity
                existing_item.save(update_fields=["quantity"])
                guest_item.delete()
            else:
                guest_item.cart = user_cart
                guest_item.save(update_fields=["cart"])

        guest_cart.delete()

    return user_cart


def _format_order_address(address_line1, address_line2, town_city, county, eircode, country="Ireland"):
    lines = [
        address_line1,
        address_line2,
        f"{town_city}, {county}".strip(", "),
        eircode,
        country or "Ireland",
    ]
    return "\n".join([line for line in lines if line])


def _create_saved_shipping_address(user, validated_address):
    requested_default = bool(validated_address.get("is_default"))
    has_existing = ShippingAddress.objects.filter(user=user).exists()
    should_be_default = requested_default or not has_existing

    if should_be_default:
        ShippingAddress.objects.filter(user=user, is_default=True).update(is_default=False)

    return ShippingAddress.objects.create(
        user=user,
        label=validated_address.get("label", ""),
        full_name=validated_address["full_name"],
        phone=validated_address["phone"],
        address_line1=validated_address["address_line1"],
        address_line2=validated_address.get("address_line2", ""),
        town_city=validated_address["town_city"],
        county=validated_address["county"],
        eircode=validated_address["eircode"],
        country="Ireland",
        is_default=should_be_default,
    )


def _resolve_shipping_for_order(user, address_id=None, shipping_address_payload=None, save_shipping_address=False):
    selected_shipping = None
    validated_shipping_data = None

    if address_id:
        selected_shipping = ShippingAddress.objects.filter(id=address_id, user=user).first()
        if not selected_shipping:
            raise ValueError("Selected shipping address not found.")
    elif shipping_address_payload:
        shipping_serializer = ShippingAddressSerializer(data=shipping_address_payload)
        if not shipping_serializer.is_valid():
            raise ValueError(f"Invalid shipping address: {shipping_serializer.errors}")
        validated_shipping_data = shipping_serializer.validated_data
        if save_shipping_address:
            selected_shipping = _create_saved_shipping_address(user, validated_shipping_data)
    else:
        selected_shipping = ShippingAddress.objects.filter(user=user, is_default=True).first()
        if not selected_shipping:
            raise ValueError("Please select a saved address or add a new delivery address.")

    if selected_shipping:
        full_name = selected_shipping.full_name
        phone = selected_shipping.phone
        address = _format_order_address(
            selected_shipping.address_line1,
            selected_shipping.address_line2,
            selected_shipping.town_city,
            selected_shipping.county,
            selected_shipping.eircode,
            selected_shipping.country,
        )
        city = selected_shipping.town_city
        state = f"{selected_shipping.county}, {selected_shipping.eircode}"
    else:
        full_name = validated_shipping_data["full_name"]
        phone = validated_shipping_data["phone"]
        address = _format_order_address(
            validated_shipping_data["address_line1"],
            validated_shipping_data.get("address_line2", ""),
            validated_shipping_data["town_city"],
            validated_shipping_data["county"],
            validated_shipping_data["eircode"],
            validated_shipping_data.get("country", "Ireland"),
        )
        city = validated_shipping_data["town_city"]
        state = f"{validated_shipping_data['county']}, {validated_shipping_data['eircode']}"

    return full_name, phone, address, city, state


def _create_order_from_cart(
    user,
    cart_code,
    address_id=None,
    shipping_address_payload=None,
    save_shipping_address=False,
    payment_transaction=None,
):
    cart = Cart.objects.filter(cart_code=cart_code, paid=False).prefetch_related("items__product").first()
    if not cart:
        raise ValueError("Cart not found.")

    items = list(cart.items.all())
    if not items:
        raise ValueError("Your cart is empty.")

    full_name, phone, address, city, state = _resolve_shipping_for_order(
        user,
        address_id=address_id,
        shipping_address_payload=shipping_address_payload,
        save_shipping_address=save_shipping_address,
    )

    with transaction.atomic():
        product_ids = [item.product_id for item in items if item.product_id]
        locked_products = {
            product.id: product
            for product in Product.objects.select_for_update().filter(id__in=product_ids)
        }

        for item in items:
            product = locked_products.get(item.product_id)
            if not product:
                raise ValueError("One of the products in your cart is no longer available.")
            if product.stock < item.quantity:
                raise ValueError(f"Insufficient stock for {product.name}. Only {product.stock} left.")

        order = Order.objects.create(
            user=user,
            full_name=full_name or f"{user.first_name} {user.last_name}".strip() or user.username,
            email=user.email or "",
            phone=phone or user.phone or "",
            address=address,
            city=city,
            state=state,
            total_amount=0,
        )

        total_amount = Decimal("0")
        for item in items:
            product = locked_products[item.product_id]
            item_total = product.price * item.quantity
            total_amount += item_total

            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                product_slug=product.slug or "",
                product_price=product.price,
                product_image=product.image.name if product.image else "",
                quantity=item.quantity,
            )

            product.stock -= item.quantity
            product.save(update_fields=["stock"])

        order.total_amount = total_amount
        order.save(update_fields=["total_amount", "updated_at"])

        cart.delete()
        Cart.objects.create(cart_code=cart_code, user=user)

        if payment_transaction:
            payment_transaction.order = order
            payment_transaction.amount = total_amount
            payment_transaction.status = PaymentTransaction.STATUS_SUCCEEDED
            payment_transaction.save(update_fields=["order", "amount", "status", "updated_at"])

    return order


def _restock_order_items(order):
    with transaction.atomic():
        for order_item in order.items.select_related("product"):
            if not order_item.product_id:
                continue
            product = Product.objects.select_for_update().filter(id=order_item.product_id).first()
            if not product:
                continue
            product.stock += order_item.quantity
            product.save(update_fields=["stock"])

@api_view(["GET"])
@throttle_classes([PublicReadThrottle])
def products(request):
    products = Product.objects.filter(category__in=Product.ALLOWED_CATEGORIES)
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@throttle_classes([PublicReadThrottle])
def product_detail(request, slug):
    product = get_object_or_404(
        Product,
        slug=slug,
        category__in=Product.ALLOWED_CATEGORIES,
    )
    serializer = DetailedProductSerializer(product)
    return Response(serializer.data)


@api_view(["POST"])
@throttle_classes([CartWriteThrottle])
def add_item(request):
    try:
        # Get data from the request
        cart_code = request.data.get("cart_code")
        product_id = request.data.get("product_id")
        quantity = request.data.get("quantity", 1)

        # Validate input
        if not cart_code or not product_id:
            return Response({"error": "cart_code and product_id are required."}, status=400)

        default_user = request.user if request.user.is_authenticated else None
        cart, created = Cart.objects.get_or_create(cart_code=cart_code, defaults={"user": default_user})

        if request.user.is_authenticated:
            if cart.user and cart.user != request.user:
                return Response({"error": "This cart does not belong to the current user."}, status=403)
            if cart.user is None:
                cart.user = request.user
                cart.save(update_fields=["user"])

        product = get_object_or_404(
            Product,
            id=product_id,
            category__in=Product.ALLOWED_CATEGORIES,
        )
        quantity = int(quantity)
        if quantity < 1:
            return Response({"error": "Quantity must be at least 1."}, status=400)

        if quantity > MAX_CART_ITEM_QTY:
            return Response({"error": f"Maximum {MAX_CART_ITEM_QTY} items allowed per cart item."}, status=400)

        if product.stock <= 0:
            return Response({"error": "Product is out of stock."}, status=400)

        cartitem, created = CartItem.objects.get_or_create(cart=cart, product=product)

        # Update the quantity if the CartItem already exists
        if not created:
            new_quantity = cartitem.quantity + quantity
        else:
            new_quantity = quantity

        if new_quantity > MAX_CART_ITEM_QTY:
            return Response({"error": f"Maximum {MAX_CART_ITEM_QTY} items allowed per cart item."}, status=400)

        if new_quantity > product.stock:
            return Response({"error": f"Only {product.stock} item(s) available in stock."}, status=400)

        cartitem.quantity = new_quantity

        cartitem.save()

        # Serialize the CartItem
        serializer = CartItemSerializer(cartitem)
        return Response(
            {"data": serializer.data, "message": "Cart item added successfully."},
            status=201
        )
    except Product.DoesNotExist:
        return Response({"error": "Product not found."}, status=404)
    except ValueError:
        return Response({"error": "Invalid quantity value."}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    

@api_view(['GET'])
@throttle_classes([CartWriteThrottle])
def product_in_cart(request):
    cart_code = request.query_params.get("cart_code")
    product_id = request.query_params.get("product_id")

    cart = Cart.objects.filter(cart_code=cart_code, paid=False).first()
    product = get_object_or_404(
        Product,
        id=product_id,
        category__in=Product.ALLOWED_CATEGORIES,
    )

    if not cart:
        return Response({'product_in_cart': False})

    product_exist_in_cart = CartItem.objects.filter(cart=cart, product=product).exists()

    return Response({'product_in_cart': product_exist_in_cart})


@api_view(['GET'])
@throttle_classes([CartWriteThrottle])
def get_cart_stat(request):
    cart_code = request.query_params.get("cart_code")
    cart = Cart.objects.filter(cart_code=cart_code, paid=False).first()

    if not cart:
        return Response({"id": None, "cart_code": cart_code, "num_of_items": 0})

    serializer = SimpleCartSerializer(cart)
    return Response(serializer.data)


@api_view(["GET"])
@throttle_classes([CartWriteThrottle])
def get_cart(request):
    cart_code = request.query_params.get("cart_code")
    cart = Cart.objects.filter(cart_code=cart_code, paid=False).first()

    if not cart:
        return Response(
            {
                "id": None,
                "cart_code": cart_code,
                "items": [],
                "sum_total": 0,
                "num_of_items": 0,
                "created_at": None,
                "modified_at": None,
            }
        )

    serializer = CartSerializer(cart)
    return Response(serializer.data)


@api_view(["PATCH"])
@throttle_classes([CartWriteThrottle])
def update_quantity(request):
    cart_code = request.data.get("cart_code")
    cartitem_id = request.data.get("item_id")
    quantity = request.data.get("quantity")

    if not cart_code or cartitem_id is None or quantity is None:
        return Response(
            {"error": "cart_code, item_id and quantity are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return Response({"error": "Quantity must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)

    if quantity < 1:
        return Response({"error": "Quantity must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)

    if quantity > MAX_CART_ITEM_QTY:
        return Response(
            {"error": f"Quantity cannot exceed {MAX_CART_ITEM_QTY}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cart = Cart.objects.filter(cart_code=cart_code, paid=False).first()
    if not cart:
        return Response({"error": "Cart not found."}, status=status.HTTP_404_NOT_FOUND)

    cartitem = CartItem.objects.filter(id=cartitem_id, cart=cart).select_related("product").first()
    if not cartitem:
        return Response({"error": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)

    if cartitem.product and cartitem.product.stock < quantity:
        return Response(
            {"error": f"Only {cartitem.product.stock} item(s) available in stock."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cartitem.quantity = quantity
    cartitem.save(update_fields=["quantity"])
    serializer = CartItemSerializer(cartitem)
    return Response({"data": serializer.data, "message": "Cart item updated successfully!"})
    

@api_view(['POST'])
@throttle_classes([CartWriteThrottle])
def delete_cartitem(request):
    cartitem_id = request.data.get("item_id")
    cartitem = CartItem.objects.get(id=cartitem_id)
    cartitem.delete()
    return Response({"message": "Item deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_username(request):
    user = request.user
    guest_cart_code = request.query_params.get("guest_cart_code")
    user_cart = _merge_guest_cart_into_user_cart(user, guest_cart_code)
    num_of_items = sum([item.quantity for item in user_cart.items.all()])
    return Response(
        {
            "username": user.username,
            "is_staff": user.is_staff,
            "cart_code": user_cart.cart_code,
            "num_of_items": num_of_items,
        }
    )


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def user_info(request):
    if request.method == "GET":
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def shipping_addresses(request):
    if request.method == "GET":
        addresses = ShippingAddress.objects.filter(user=request.user)
        serializer = ShippingAddressSerializer(addresses, many=True)
        return Response(serializer.data)

    serializer = ShippingAddressSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    saved_address = _create_saved_shipping_address(request.user, serializer.validated_data)
    output = ShippingAddressSerializer(saved_address)
    return Response(output.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def set_default_shipping_address(request, address_id):
    address = get_object_or_404(ShippingAddress, id=address_id, user=request.user)
    ShippingAddress.objects.filter(user=request.user, is_default=True).exclude(id=address.id).update(
        is_default=False
    )
    if not address.is_default:
        address.is_default = True
        address.save(update_fields=["is_default", "updated_at"])

    serializer = ShippingAddressSerializer(address)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    current_password = serializer.validated_data["current_password"]
    new_password = serializer.validated_data["new_password"]

    if not user.check_password(current_password):
        return Response(
            {"current_password": ["Current password is incorrect."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for token in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass

    _audit_event("password_change", request, user=user)
    return Response({"message": "Password updated successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_orders(request):
    orders = Order.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at")
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_detail(request, order_id):
    order = get_object_or_404(Order.objects.prefetch_related("items"), id=order_id, user=request.user)
    serializer = OrderSerializer(order)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_order(request):
    cart_code = request.data.get("cart_code")
    address_id = request.data.get("address_id")
    shipping_address_payload = request.data.get("shipping_address")
    save_shipping_address = bool(request.data.get("save_shipping_address", False))

    if not cart_code:
        return Response({"error": "cart_code is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        order = _create_order_from_cart(
            request.user,
            cart_code,
            address_id=address_id,
            shipping_address_payload=shipping_address_payload,
            save_shipping_address=save_shipping_address,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = status.HTTP_400_BAD_REQUEST
        if message == "Cart not found." or message == "Selected shipping address not found.":
            status_code = status.HTTP_404_NOT_FOUND
        return Response({"error": message}, status=status_code)

    serializer = OrderSerializer(order)
    return Response(
        {"message": "Order placed successfully.", "order": serializer.data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_order(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)

    if order.status == Order.STATUS_DELIVERED:
        return Response(
            {"error": "Delivered orders cannot be cancelled."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if order.status == Order.STATUS_CANCELLED:
        return Response(
            {"error": "Order is already cancelled."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    order.status = Order.STATUS_CANCELLED
    order.save(update_fields=["status", "updated_at"])
    _restock_order_items(order)
    serializer = OrderSerializer(order)
    return Response({"message": "Order cancelled successfully.", "order": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_invoice(request, order_id):
    order = get_object_or_404(Order.objects.prefetch_related("items"), id=order_id, user=request.user)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setTitle(f"Invoice-{order.order_number}")
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(20 * mm, height - 20 * mm, "Prime Pick Invoice")

    pdf.setStrokeColor(colors.HexColor("#6050DC"))
    pdf.line(20 * mm, height - 24 * mm, width - 20 * mm, height - 24 * mm)

    pdf.setFont("Helvetica", 11)
    pdf.drawString(20 * mm, height - 35 * mm, f"Invoice #: {order.order_number}")
    pdf.drawString(20 * mm, height - 42 * mm, f"Status: {order.status}")
    pdf.drawString(20 * mm, height - 49 * mm, f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}")
    if order.tracking_number:
        pdf.drawString(20 * mm, height - 56 * mm, f"Tracking #: {order.tracking_number}")

    pdf.drawString(120 * mm, height - 35 * mm, f"Customer: {order.full_name or order.user.username}")
    pdf.drawString(120 * mm, height - 42 * mm, f"Email: {order.email}")
    pdf.drawString(120 * mm, height - 49 * mm, f"Phone: {order.phone}")

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(20 * mm, height - 65 * mm, "Shipping Address")
    pdf.setFont("Helvetica", 11)
    address_lines = [order.address, f"{order.city}, {order.state}".strip(", ")]
    y_position = height - 72 * mm
    for line in address_lines:
        if line:
            pdf.drawString(20 * mm, y_position, line)
            y_position -= 6 * mm

    table_top = height - 95 * mm
    pdf.setFillColor(colors.HexColor("#6050DC"))
    pdf.rect(20 * mm, table_top, width - 40 * mm, 10 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(24 * mm, table_top + 3.5 * mm, "Item")
    pdf.drawString(110 * mm, table_top + 3.5 * mm, "Qty")
    pdf.drawString(130 * mm, table_top + 3.5 * mm, "Price")
    pdf.drawString(160 * mm, table_top + 3.5 * mm, "Subtotal")

    row_y = table_top - 8 * mm
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 10)
    for item in order.items.all():
        if row_y < 35 * mm:
            pdf.showPage()
            row_y = height - 30 * mm
            pdf.setFont("Helvetica", 10)

        pdf.drawString(24 * mm, row_y, item.product_name[:40])
        pdf.drawString(110 * mm, row_y, str(item.quantity))
        pdf.drawString(130 * mm, row_y, f"${item.product_price:.2f}")
        pdf.drawString(160 * mm, row_y, f"${(item.product_price * item.quantity):.2f}")
        row_y -= 8 * mm

    pdf.setStrokeColor(colors.HexColor("#DDDDDD"))
    pdf.line(20 * mm, row_y, width - 20 * mm, row_y)
    row_y -= 10 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(130 * mm, row_y, "Total")
    pdf.drawString(160 * mm, row_y, f"${order.total_amount:.2f}")

    pdf.setFont("Helvetica", 10)
    pdf.drawString(20 * mm, 15 * mm, "Thank you for shopping with Prime Pick.")
    pdf.save()
    buffer.seek(0)

    return FileResponse(buffer, as_attachment=True, filename=f"invoice-{order.order_number}.pdf")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([PaymentCreateThrottle])
def create_stripe_checkout_session(request):
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    if not django_settings.STRIPE_SECRET_KEY:
        return Response({"error": "Stripe secret key is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    cart_code = request.data.get("cart_code")
    address_id = request.data.get("address_id")
    shipping_address_payload = request.data.get("shipping_address")
    save_shipping_address = bool(request.data.get("save_shipping_address", False))

    idempotency_key = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key")
    if not idempotency_key:
        return Response({"error": "Idempotency-Key is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not cart_code:
        return Response({"error": "cart_code is required."}, status=status.HTTP_400_BAD_REQUEST)

    existing_txn = PaymentTransaction.objects.filter(idempotency_key=idempotency_key, user=request.user).first()
    if existing_txn and existing_txn.stripe_session_id:
        session = stripe.checkout.Session.retrieve(existing_txn.stripe_session_id)
        return Response(
            {
                "checkout_url": session.url,
                "session_id": existing_txn.stripe_session_id,
                "idempotency_key": existing_txn.idempotency_key,
            }
        )

    cart = Cart.objects.filter(cart_code=cart_code, paid=False).prefetch_related("items__product").first()
    if not cart:
        return Response({"error": "Cart not found."}, status=status.HTTP_404_NOT_FOUND)

    items = list(cart.items.all())
    if not items:
        return Response({"error": "Your cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

    subtotal = sum([item.product.price * item.quantity for item in items])
    amount_cents = int((subtotal * Decimal("100")).quantize(Decimal("1")))

    frontend_base = django_settings.FRONTEND_BASE_URL.rstrip("/")
    success_url = f"{frontend_base}/checkout?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_base}/checkout?payment=failed"

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {"name": "Prime Pick Order"},
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "user_id": str(request.user.id),
                "cart_code": cart_code,
                "idempotency_key": idempotency_key,
            },
            idempotency_key=idempotency_key,
        )
    except Exception as exc:
        _audit_event("stripe_session_create", request, user=request.user, status_text="failed")
        if django_settings.DEBUG:
            return Response(
                {"error": f"Failed to create payment session. {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"error": "Failed to create payment session."}, status=status.HTTP_502_BAD_GATEWAY)

    txn = existing_txn or PaymentTransaction(user=request.user, idempotency_key=idempotency_key)
    txn.provider = "stripe"
    txn.cart_code = cart_code
    txn.address_id = address_id
    txn.shipping_payload = shipping_address_payload
    txn.save_shipping_address = save_shipping_address
    txn.amount = subtotal
    txn.currency = "usd"
    txn.status = PaymentTransaction.STATUS_CREATED
    txn.stripe_session_id = checkout_session.id
    txn.stripe_payment_intent_id = checkout_session.payment_intent
    txn.save()

    _audit_event("stripe_session_create", request, user=request.user)
    return Response(
        {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id,
            "idempotency_key": idempotency_key,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stripe_session_status(request):
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    session_id = request.query_params.get("session_id")
    if not session_id:
        return Response({"error": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    txn = (
        PaymentTransaction.objects.filter(stripe_session_id=session_id, user=request.user)
        .select_related("user", "order")
        .first()
    )
    if not txn:
        return Response({"error": "Payment session not found."}, status=status.HTTP_404_NOT_FOUND)

    if txn.order_id:
        return Response(
            {
                "payment_status": txn.status,
                "order_created": True,
                "order_id": txn.order_id,
            }
        )

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception:
        return Response(
            {
                "payment_status": txn.status,
                "order_created": False,
                "order_id": None,
            }
        )

    if session.get("payment_status") == "paid" and not txn.order_id:
        try:
            _create_order_from_cart(
                txn.user,
                txn.cart_code,
                address_id=txn.address_id,
                shipping_address_payload=txn.shipping_payload,
                save_shipping_address=txn.save_shipping_address,
                payment_transaction=txn,
            )
        except Exception:
            txn.status = PaymentTransaction.STATUS_FAILED
            txn.save(update_fields=["status", "updated_at"])

    txn.refresh_from_db()
    return Response(
        {
            "payment_status": txn.status,
            "order_created": bool(txn.order_id),
            "order_id": txn.order_id,
        }
    )


@api_view(["POST"])
def stripe_webhook(request):
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    secret = django_settings.STRIPE_WEBHOOK_SECRET

    if not secret:
        return Response({"error": "Stripe webhook secret not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=secret)
    except ValueError:
        return Response({"error": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.SignatureVerificationError:
        return Response({"error": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

    if PaymentWebhookEvent.objects.filter(event_id=event["id"]).exists():
        return Response({"message": "Duplicate event ignored."}, status=status.HTTP_200_OK)

    PaymentWebhookEvent.objects.create(
        provider="stripe",
        event_id=event["id"],
        event_type=event["type"],
    )

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        txn = PaymentTransaction.objects.filter(stripe_session_id=session.get("id")).select_related("user").first()

        if txn and not txn.order_id:
            try:
                _create_order_from_cart(
                    txn.user,
                    txn.cart_code,
                    address_id=txn.address_id,
                    shipping_address_payload=txn.shipping_payload,
                    save_shipping_address=txn.save_shipping_address,
                    payment_transaction=txn,
                )
                _audit_event("stripe_webhook_checkout_completed", request, user=txn.user)
            except Exception:
                txn.status = PaymentTransaction.STATUS_FAILED
                txn.save(update_fields=["status", "updated_at"])

    if event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        txn = PaymentTransaction.objects.filter(stripe_session_id=session.get("id")).first()
        if txn and txn.status == PaymentTransaction.STATUS_CREATED:
            txn.status = PaymentTransaction.STATUS_EXPIRED
            txn.save(update_fields=["status", "updated_at"])

    return Response({"received": True}, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([RegisterThrottle])
def register(request):
    try:
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")

        # Validate required fields
        if not username or not email or not password:
            return Response(
                {"error": "Username, email, and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if username already exists
        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create inactive user until OTP verification succeeds
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=False,
        )

        _, otp_code = _set_user_email_otp(user)

        try:
            _send_registration_otp_email(user, otp_code)
        except Exception:
            user.delete()
            _audit_event("register_otp_send", request, user=user, status_text="failed")
            return _email_send_error_response("Failed to send OTP email. Please try again.")

        _audit_event("register", request, user=user)

        response_data = {
            "message": "Registration successful. Please verify your email with OTP.",
            "username": user.username,
            "email": user.email,
        }

        return Response(
            response_data,
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["POST"])
@throttle_classes([OTPVerifyThrottle])
def verify_email_otp(request):
    email = request.data.get("email")
    otp_code = request.data.get("otp")

    if not email or not otp_code:
        return Response(
            {"error": "Email and OTP are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.filter(email=email).first()
    if not user:
        return Response({"error": "User with this email was not found."}, status=status.HTTP_404_NOT_FOUND)

    if user.is_active:
        return Response({"message": "Email already verified."}, status=status.HTTP_200_OK)

    otp_record = EmailOTP.objects.filter(user=user).first()
    if not otp_record:
        return Response({"error": "OTP not found. Please request a new OTP."}, status=status.HTTP_404_NOT_FOUND)

    if otp_record.lockout_until and otp_record.lockout_until > timezone.now():
        return Response(
            {"error": "Too many invalid OTP attempts. Please request a new OTP."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if otp_record.expires_at < timezone.now():
        return Response({"error": "OTP has expired. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

    if not check_password(str(otp_code).strip(), otp_record.otp_code):
        otp_record.failed_attempts += 1
        if otp_record.failed_attempts >= MAX_OTP_ATTEMPTS:
            otp_record.lockout_until = timezone.now() + timedelta(minutes=django_settings.EMAIL_OTP_EXPIRE_MINUTES)
        otp_record.save(update_fields=["failed_attempts", "lockout_until", "updated_at"])
        _audit_event("register_otp_verify", request, user=user, status_text="failed")
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    user.is_active = True
    user.save(update_fields=["is_active"])

    otp_record.is_verified = True
    otp_record.failed_attempts = 0
    otp_record.lockout_until = None
    otp_record.save(update_fields=["is_verified", "failed_attempts", "lockout_until", "updated_at"])

    _audit_event("register_otp_verify", request, user=user)

    return Response({"message": "Email verified successfully. You can now log in."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([OTPRequestThrottle])
def resend_email_otp(request):
    email = request.data.get("email")
    if not email:
        return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email=email).first()
    if not user:
        return Response({"error": "User with this email was not found."}, status=status.HTTP_404_NOT_FOUND)

    if user.is_active:
        return Response({"message": "Email is already verified."}, status=status.HTTP_200_OK)

    _, otp_code = _set_user_email_otp(user)

    try:
        _send_registration_otp_email(user, otp_code)
    except Exception:
        _audit_event("register_otp_resend", request, user=user, status_text="failed")
        return _email_send_error_response("Failed to resend OTP email. Please try again.")

    _audit_event("register_otp_resend", request, user=user)

    response_data = {"message": "A new OTP has been sent to your email."}
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([OTPRequestThrottle])
def login_request_otp(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "Username and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request=request, username=username, password=password)
    if not user:
        _audit_event("login_password", request, status_text="failed", details="invalid_credentials")
        return Response({"error": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.is_active:
        return Response(
            {"error": "Your account is not active. Please verify your email first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    _, otp_code = _set_user_email_otp(user)
    try:
        _send_login_otp_email(user, otp_code)
    except Exception:
        _audit_event("login_otp_send", request, user=user, status_text="failed")
        return _email_send_error_response("Failed to send login OTP. Please try again.")

    _audit_event("login_password", request, user=user)

    challenge_token = signing.dumps({"user_id": user.id, "purpose": "login_otp"}, salt="login-otp")
    response_data = {
        "message": "OTP sent to your registered email.",
        "challenge": challenge_token,
        "email": user.email,
    }

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([OTPVerifyThrottle])
def login_verify_otp(request):
    challenge = request.data.get("challenge")
    otp_code = (request.data.get("otp") or "").strip()

    if not challenge or not otp_code:
        return Response(
            {"error": "Challenge and OTP are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        payload = signing.loads(
            challenge,
            salt="login-otp",
            max_age=django_settings.EMAIL_OTP_EXPIRE_MINUTES * 60,
        )
    except SignatureExpired:
        return Response(
            {"error": "Login session expired. Please enter your password again."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except BadSignature:
        return Response({"error": "Invalid login session."}, status=status.HTTP_400_BAD_REQUEST)

    if payload.get("purpose") != "login_otp":
        return Response({"error": "Invalid login session."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(id=payload.get("user_id"), is_active=True).first()
    if not user:
        return Response({"error": "User not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

    otp_record = EmailOTP.objects.filter(user=user).first()
    if not otp_record:
        return Response({"error": "OTP not found. Please try login again."}, status=status.HTTP_404_NOT_FOUND)

    if otp_record.lockout_until and otp_record.lockout_until > timezone.now():
        return Response(
            {"error": "Too many invalid OTP attempts. Please login again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if otp_record.expires_at < timezone.now():
        return Response({"error": "OTP has expired. Please login again."}, status=status.HTTP_400_BAD_REQUEST)

    if not check_password(otp_code, otp_record.otp_code):
        otp_record.failed_attempts += 1
        if otp_record.failed_attempts >= MAX_OTP_ATTEMPTS:
            otp_record.lockout_until = timezone.now() + timedelta(minutes=django_settings.EMAIL_OTP_EXPIRE_MINUTES)
        otp_record.save(update_fields=["failed_attempts", "lockout_until", "updated_at"])
        _audit_event("login_otp_verify", request, user=user, status_text="failed")
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    otp_record.is_verified = True
    otp_record.failed_attempts = 0
    otp_record.lockout_until = None
    otp_record.save(update_fields=["is_verified", "failed_attempts", "lockout_until", "updated_at"])

    refresh = RefreshToken.for_user(user)
    _audit_event("login_otp_verify", request, user=user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "message": "Login successful.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@throttle_classes([OTPRequestThrottle])
def password_reset_request_otp(request):
    email = (request.data.get("email") or "").strip()
    if not email:
        return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if not user:
        _audit_event("password_reset_request", request, status_text="failed", details="user_not_found")
        return Response({"error": "User with this email was not found."}, status=status.HTTP_404_NOT_FOUND)

    _, otp_code = _set_user_email_otp(user)
    try:
        _send_password_reset_otp_email(user, otp_code)
    except Exception:
        _audit_event("password_reset_request", request, user=user, status_text="failed")
        return _email_send_error_response("Failed to send password reset OTP. Please try again.")

    challenge_token = signing.dumps({"user_id": user.id, "purpose": "password_reset_otp"}, salt="password-reset-otp")
    _audit_event("password_reset_request", request, user=user)
    return Response(
        {
            "message": "OTP sent to your email.",
            "challenge": challenge_token,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@throttle_classes([OTPVerifyThrottle])
def password_reset_verify_otp(request):
    challenge = request.data.get("challenge")
    otp_code = (request.data.get("otp") or "").strip()

    if not challenge or not otp_code:
        return Response(
            {"error": "Challenge and OTP are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        payload = signing.loads(
            challenge,
            salt="password-reset-otp",
            max_age=django_settings.EMAIL_OTP_EXPIRE_MINUTES * 60,
        )
    except SignatureExpired:
        return Response(
            {"error": "Reset session expired. Please request a new OTP."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except BadSignature:
        return Response({"error": "Invalid reset session."}, status=status.HTTP_400_BAD_REQUEST)

    if payload.get("purpose") != "password_reset_otp":
        return Response({"error": "Invalid reset session."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(id=payload.get("user_id"), is_active=True).first()
    if not user:
        return Response({"error": "User not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

    otp_record = EmailOTP.objects.filter(user=user).first()
    if not otp_record:
        return Response({"error": "OTP not found. Please request a new OTP."}, status=status.HTTP_404_NOT_FOUND)

    if otp_record.lockout_until and otp_record.lockout_until > timezone.now():
        return Response(
            {"error": "Too many invalid OTP attempts. Please request a new OTP later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if otp_record.expires_at < timezone.now():
        return Response({"error": "OTP has expired. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

    if not check_password(otp_code, otp_record.otp_code):
        otp_record.failed_attempts += 1
        if otp_record.failed_attempts >= MAX_OTP_ATTEMPTS:
            otp_record.lockout_until = timezone.now() + timedelta(minutes=django_settings.EMAIL_OTP_EXPIRE_MINUTES)
        otp_record.save(update_fields=["failed_attempts", "lockout_until", "updated_at"])
        _audit_event("password_reset_verify", request, user=user, status_text="failed")
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    otp_record.is_verified = True
    otp_record.failed_attempts = 0
    otp_record.lockout_until = None
    otp_record.save(update_fields=["is_verified", "failed_attempts", "lockout_until", "updated_at"])

    reset_token = signing.dumps(
        {
            "user_id": user.id,
            "purpose": "password_reset_confirm",
            "pwd": user.password,
        },
        salt="password-reset-confirm",
    )

    _audit_event("password_reset_verify", request, user=user)
    return Response(
        {
            "message": "OTP verified. You can now set a new password.",
            "reset_token": reset_token,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@throttle_classes([OTPVerifyThrottle])
def password_reset_confirm(request):
    reset_token = request.data.get("reset_token")
    if not reset_token:
        return Response({"error": "reset_token is required."}, status=status.HTTP_400_BAD_REQUEST)

    serializer = PasswordResetConfirmSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = signing.loads(
            reset_token,
            salt="password-reset-confirm",
            max_age=django_settings.EMAIL_OTP_EXPIRE_MINUTES * 60,
        )
    except SignatureExpired:
        return Response(
            {"error": "Reset token expired. Please verify OTP again."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except BadSignature:
        return Response({"error": "Invalid reset token."}, status=status.HTTP_400_BAD_REQUEST)

    if payload.get("purpose") != "password_reset_confirm":
        return Response({"error": "Invalid reset token."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(id=payload.get("user_id"), is_active=True).first()
    if not user:
        return Response({"error": "User not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

    if payload.get("pwd") != user.password:
        return Response(
            {"error": "Reset token is no longer valid. Please restart reset password flow."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(serializer.validated_data["new_password"])
    user.save(update_fields=["password"])

    EmailOTP.objects.filter(user=user).update(is_verified=False, failed_attempts=0, lockout_until=None)

    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for token in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass

    _audit_event("password_reset_confirm", request, user=user)
    return Response({"message": "Password reset successful. Please log in with your new password."})

