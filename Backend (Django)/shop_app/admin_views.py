from django.db.models import Sum
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle

from .models import Order, Product
from .serializers import AdminProductSerializer, OrderSerializer


class AdminWriteThrottle(ScopedRateThrottle):
    scope = "admin_write"


@api_view(["GET"])
@permission_classes([IsAdminUser])
@throttle_classes([AdminWriteThrottle])
def admin_stats(request):
    total_products = Product.objects.count()
    out_of_stock = Product.objects.filter(stock=0).count()
    total_orders = Order.objects.count()
    revenue = (
        Order.objects.exclude(status=Order.STATUS_CANCELLED)
        .aggregate(total=Sum("total_amount"))["total"]
        or 0
    )
    pending_orders = Order.objects.filter(status=Order.STATUS_PENDING).count()
    return Response(
        {
            "total_products": total_products,
            "out_of_stock": out_of_stock,
            "total_orders": total_orders,
            "revenue": float(revenue),
            "pending_orders": pending_orders,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
@throttle_classes([AdminWriteThrottle])
def admin_products(request):
    if request.method == "GET":
        products = Product.objects.all().order_by("-id")
        serializer = AdminProductSerializer(products, many=True, context={"request": request})
        return Response(serializer.data)

    # POST — create
    serializer = AdminProductSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminUser])
@throttle_classes([AdminWriteThrottle])
def admin_product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if request.method == "GET":
        serializer = AdminProductSerializer(product, context={"request": request})
        return Response(serializer.data)

    if request.method == "DELETE":
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT or PATCH
    partial = request.method == "PATCH"
    serializer = AdminProductSerializer(
        product, data=request.data, partial=partial, context={"request": request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAdminUser])
@throttle_classes([AdminWriteThrottle])
def admin_orders(request):
    orders = (
        Order.objects.prefetch_related("items")
        .select_related("user")
        .order_by("-created_at")
    )
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
@throttle_classes([AdminWriteThrottle])
def admin_order_status(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    new_status = request.data.get("status")
    valid_statuses = [s[0] for s in Order.STATUS_CHOICES]
    if new_status not in valid_statuses:
        return Response(
            {"status": f"Invalid status. Choose from: {', '.join(valid_statuses)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if order.status == Order.STATUS_CANCELLED and new_status != Order.STATUS_CANCELLED:
        return Response(
            {"status": "Cancelled orders cannot be moved to another status."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Only allow marking as Delivered after the order has been Shipped.
    if new_status == Order.STATUS_DELIVERED and order.status != Order.STATUS_SHIPPED:
        return Response(
            {"status": "Order can be marked as Delivered only after it is Shipped."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_status == Order.STATUS_CANCELLED and order.status != Order.STATUS_CANCELLED:
        with transaction.atomic():
            for order_item in order.items.select_related("product"):
                if not order_item.product_id:
                    continue
                product = Product.objects.select_for_update().filter(id=order_item.product_id).first()
                if not product:
                    continue
                product.stock += order_item.quantity
                product.save(update_fields=["stock"])

            order.status = new_status
            order.save()
    else:
        order.status = new_status
        order.save()
    serializer = OrderSerializer(order)
    return Response(serializer.data)
