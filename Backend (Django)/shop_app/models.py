from django.conf import settings
from django.db import models
from django.utils.text import slugify
from django.utils import timezone
import uuid


# Create your models here.
class Product(models.Model):
    ALLOWED_CATEGORIES = ("T-Shirt", "Pants")
    CATEGORY = tuple((category, category) for category in ALLOWED_CATEGORIES)
    
    name = models.CharField(max_length=100)
    slug = models.SlugField(blank=True, null=True)
    image = models.ImageField(upload_to="img")
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=15, choices=CATEGORY, blank=True, null=True)
    stock = models.PositiveIntegerField(default=0)

    @property
    def is_in_stock(self):
        return self.stock > 0

    def __str__(self):
        return self.name
    
    # Make Slug Unique
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
            unique_slug = self.slug
            counter = 1
            if Product.objects.filter(slug=unique_slug).exists():
                unique_slug = f'{self.slug}-{counter}'
                counter+=1
            self.slug = unique_slug
        
        super().save(*args, **kwargs)


class Cart(models.Model):
    cart_code = models.CharField(max_length=11, unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, blank=True, null=True)
    paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    modified_at = models.DateTimeField(auto_now=True, blank=True, null=True)

    def __str__(self):
        return self.cart_code
    

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product =  models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.product.name} in cart {self.cart.id}"


class ShippingAddress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="shipping_addresses",
        on_delete=models.CASCADE,
    )
    label = models.CharField(max_length=50, blank=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    town_city = models.CharField(max_length=100)
    county = models.CharField(max_length=100)
    eircode = models.CharField(max_length=12)
    country = models.CharField(max_length=50, default="Ireland")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-updated_at"]

    def __str__(self):
        label = self.label or "Address"
        return f"{self.user.username} - {label}"


class EmailOTP(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="email_otp",
        on_delete=models.CASCADE,
    )
    otp_code = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    failed_attempts = models.PositiveIntegerField(default=0)
    lockout_until = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"OTP for {self.user.username}"


class Order(models.Model):
    STATUS_PENDING = "Pending"
    STATUS_PROCESSING = "Processing"
    STATUS_SHIPPED = "Shipped"
    STATUS_DELIVERED = "Delivered"
    STATUS_CANCELLED = "Cancelled"

    STATUS_CHOICES = (
        (STATUS_PENDING, STATUS_PENDING),
        (STATUS_PROCESSING, STATUS_PROCESSING),
        (STATUS_SHIPPED, STATUS_SHIPPED),
        (STATUS_DELIVERED, STATUS_DELIVERED),
        (STATUS_CANCELLED, STATUS_CANCELLED),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="orders",
        on_delete=models.CASCADE,
    )
    order_number = models.CharField(max_length=30, unique=True, blank=True)
    tracking_number = models.CharField(max_length=30, blank=True, help_text="Auto-generated when order is shipped")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    full_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.order_number or f"Order {self.pk}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
            self.order_number = f"PP-{timestamp}-{uuid.uuid4().hex[:6].upper()}"
        # Auto-generate tracking number when order is first marked as Shipped
        if self.pk and not self.tracking_number and self.status == self.STATUS_SHIPPED:
            prev_status = Order.objects.filter(pk=self.pk).values_list("status", flat=True).first()
            if prev_status != self.STATUS_SHIPPED:
                self.tracking_number = f"TRK-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=100)
    product_slug = models.SlugField(blank=True)
    product_price = models.DecimalField(max_digits=10, decimal_places=2)
    product_image = models.CharField(max_length=255, blank=True)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"


class PaymentTransaction(models.Model):
    STATUS_CREATED = "created"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = (
        (STATUS_CREATED, "Created"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
        (STATUS_EXPIRED, "Expired"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="payment_transactions", on_delete=models.CASCADE)
    order = models.ForeignKey(Order, related_name="payment_transactions", on_delete=models.SET_NULL, blank=True, null=True)
    provider = models.CharField(max_length=30, default="stripe")
    idempotency_key = models.CharField(max_length=80, unique=True)
    stripe_session_id = models.CharField(max_length=255, unique=True, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    cart_code = models.CharField(max_length=11)
    address_id = models.IntegerField(blank=True, null=True)
    shipping_payload = models.JSONField(blank=True, null=True)
    save_shipping_address = models.BooleanField(default=False)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="usd")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CREATED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.provider}:{self.idempotency_key} ({self.status})"


class PaymentWebhookEvent(models.Model):
    provider = models.CharField(max_length=30, default="stripe")
    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.provider}:{self.event_type}:{self.event_id}"