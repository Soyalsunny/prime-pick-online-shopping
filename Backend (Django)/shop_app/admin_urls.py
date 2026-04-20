from django.urls import path
from . import admin_views

urlpatterns = [
    path("stats", admin_views.admin_stats, name="admin_stats"),
    path("products", admin_views.admin_products, name="admin_products"),
    path("products/<int:product_id>/", admin_views.admin_product_detail, name="admin_product_detail"),
    path("orders", admin_views.admin_orders, name="admin_orders"),
    path("orders/<int:order_id>/status/", admin_views.admin_order_status, name="admin_order_status"),
]
