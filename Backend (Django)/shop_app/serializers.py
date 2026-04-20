from django.contrib.auth import get_user_model
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .models import Cart, CartItem, Order, OrderItem, PaymentTransaction, Product, ShippingAddress

class ProductSerializer(serializers.ModelSerializer):
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "image", "description", "category", "price", "stock", "is_in_stock"]

    def get_is_in_stock(self, product):
        return product.stock > 0

    
class DetailedProductSerializer(serializers.ModelSerializer):
    similar_products = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name", "price", "slug", "image", "description", "category", "stock", "is_in_stock", "similar_products"]

    def get_is_in_stock(self, product):
        return product.stock > 0

    def get_similar_products(self, product):
        products = Product.objects.filter(category=product.category).exclude(id=product.id)
        serializer = ProductSerializer(products, many=True)
        return serializer.data
    

class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    total = serializers.SerializerMethodField()
    class Meta:
        model = CartItem
        fields = ["id", "quantity", "product", "total"]

    def get_total(self, cartItem):
        price = cartItem.product.price * cartItem.quantity
        return price
    

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(read_only=True, many=True)
    sum_total = serializers.SerializerMethodField()
    num_of_items = serializers.SerializerMethodField()
    class Meta:
        model = Cart
        fields = ["id", "cart_code", "items", "sum_total", "num_of_items", "created_at", "modified_at"]

    def get_sum_total(self, cart):
        items = cart.items.all()
        total = sum([item.product.price * item.quantity for item in items])
        return total
    
    def get_num_of_items(self, cart):
        items = cart.items.all()
        total = sum([item.quantity for item in items])
        return total


class SimpleCartSerializer((serializers.ModelSerializer)):
    num_of_items = serializers.SerializerMethodField()
    class Meta:
        model = Cart
        fields = ["id", "cart_code", "num_of_items"]

    def get_num_of_items(self, cart):
        num_of_items = sum([item.quantity for item in cart.items.all()])
        return num_of_items
    

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "username", "first_name", "last_name", "email", "city", "state", "address", "phone"]


class ShippingAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingAddress
        fields = [
            "id",
            "label",
            "full_name",
            "phone",
            "address_line1",
            "address_line2",
            "town_city",
            "county",
            "eircode",
            "country",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_country(self, value):
        if value and value.strip().lower() != "ireland":
            raise serializers.ValidationError("Only Ireland addresses are supported.")
        return "Ireland"

    def validate_eircode(self, value):
        normalized = (value or "").strip().upper().replace(" ", "")
        if len(normalized) < 6 or len(normalized) > 7:
            raise serializers.ValidationError("Enter a valid Eircode.")
        return normalized


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_name",
            "product_slug",
            "product_price",
            "product_image",
            "quantity",
            "subtotal",
        ]

    def get_subtotal(self, order_item):
        return order_item.product_price * order_item.quantity


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    can_cancel = serializers.SerializerMethodField()
    tracking_steps = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "tracking_number",
            "status",
            "total_amount",
            "full_name",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "created_at",
            "updated_at",
            "can_cancel",
            "tracking_steps",
            "progress_percent",
            "payment_status",
            "items",
        ]

    def get_can_cancel(self, order):
        return order.status != Order.STATUS_DELIVERED and order.status != Order.STATUS_CANCELLED

    def get_tracking_steps(self, order):
        statuses = [
            ("ordered", "Ordered", order.created_at),
            ("processing", "Processing", order.updated_at),
            ("shipped", "Shipped", order.updated_at),
            ("delivered", "Delivered", order.updated_at),
        ]
        status_rank = {
            Order.STATUS_PENDING: 1,
            Order.STATUS_PROCESSING: 2,
            Order.STATUS_SHIPPED: 3,
            Order.STATUS_DELIVERED: 4,
            Order.STATUS_CANCELLED: 1,
        }
        current_rank = status_rank.get(order.status, 1)
        steps = []

        for index, (key, label, timestamp) in enumerate(statuses, start=1):
            steps.append(
                {
                    "key": key,
                    "label": label,
                    "completed": current_rank > index or order.status == Order.STATUS_DELIVERED and index <= 4,
                    "active": current_rank == index and order.status != Order.STATUS_CANCELLED,
                    "timestamp": timestamp,
                }
            )

        if order.status == Order.STATUS_CANCELLED:
            steps.append(
                {
                    "key": "cancelled",
                    "label": "Cancelled",
                    "completed": True,
                    "active": True,
                    "timestamp": order.updated_at,
                }
            )

        return steps

    def get_progress_percent(self, order):
        progress_map = {
            Order.STATUS_PENDING: 25,
            Order.STATUS_PROCESSING: 50,
            Order.STATUS_SHIPPED: 75,
            Order.STATUS_DELIVERED: 100,
            Order.STATUS_CANCELLED: 0,
        }
        return progress_map.get(order.status, 0)

    def get_payment_status(self, order):
        latest_payment = (
            PaymentTransaction.objects.filter(order=order)
            .order_by("-updated_at", "-id")
            .first()
        )
        if latest_payment:
            return latest_payment.status
        return "not_required"


class AdminProductSerializer(serializers.ModelSerializer):
    is_in_stock = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "image", "image_url",
            "description", "category", "price", "stock", "is_in_stock",
        ]
        read_only_fields = ["slug"]
        extra_kwargs = {
            "image": {"required": False},
        }

    def get_is_in_stock(self, product):
        return product.stock > 0

    def get_image_url(self, product):
        request = self.context.get("request")
        if product.image and hasattr(product.image, "url"):
            return request.build_absolute_uri(product.image.url) if request else product.image.url
        return None

    def validate_image(self, image):
        # Defense-in-depth for upload validation: extension, MIME, magic bytes, and decode validation.
        allowed_extensions = (".jpg", ".jpeg")
        allowed_mime_types = ("image/jpeg", "image/pjpeg")

        file_name = (getattr(image, "name", "") or "").lower()
        if not file_name.endswith(allowed_extensions):
            raise serializers.ValidationError("Only .jpg or .jpeg image files are allowed.")

        content_type = getattr(image, "content_type", "")
        if content_type and content_type.lower() not in allowed_mime_types:
            raise serializers.ValidationError("Invalid image content type. Only JPEG images are allowed.")

        header = image.read(3)
        image.seek(0)
        if header != b"\xff\xd8\xff":
            raise serializers.ValidationError("Invalid JPEG signature. Please upload a valid JPEG image.")

        try:
            pil_image = Image.open(image)
            pil_image.verify()
            image.seek(0)
            pil_image = Image.open(image)
            if (pil_image.format or "").upper() != "JPEG":
                raise serializers.ValidationError("Only JPEG image format is allowed.")
        except (UnidentifiedImageError, OSError):
            raise serializers.ValidationError("Invalid or corrupted image file.")
        finally:
            image.seek(0)

        return image

    def validate(self, attrs):
        # On create (no instance), image is required
        if self.instance is None and not attrs.get("image"):
            raise serializers.ValidationError({"image": "At least one photo is required."})
        return attrs

