from django.contrib import admin

from .models import Cart, CartItem, EmailOTP, Order, OrderItem, Product, ShippingAddress

# Register your models here.

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ("order_number", "tracking_number", "user", "status", "total_amount", "created_at")
	list_filter = ("status", "created_at")
	search_fields = ("order_number", "tracking_number", "user__username", "email")
	readonly_fields = ("order_number",)
	fields = (
		"user", "order_number", "tracking_number", "status",
		"total_amount", "full_name", "email", "phone",
		"address", "city", "state",
	)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
	list_display = ("order", "product_name", "quantity", "product_price")
	search_fields = ("order__order_number", "product_name")


@admin.register(ShippingAddress)
class ShippingAddressAdmin(admin.ModelAdmin):
	list_display = ("user", "label", "full_name", "county", "eircode", "is_default", "updated_at")
	list_filter = ("county", "is_default")
	search_fields = ("user__username", "full_name", "eircode", "address_line1")


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
	list_display = ("user", "otp_code", "is_verified", "expires_at", "updated_at")
	list_filter = ("is_verified",)
	search_fields = ("user__username", "user__email")


admin.site.register([Product, Cart, CartItem])
