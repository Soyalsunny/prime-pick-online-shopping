from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from shop_app.models import Order


class VEMTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user(username="usera", email="a@example.com", password="pass1234")
        self.user_b = User.objects.create_user(username="userb", email="b@example.com", password="pass1234")

        # Create an order for user_a
        self.order = Order.objects.create(
            user=self.user_a,
            total_amount=10.00,
            full_name="User A",
            email="a@example.com",
            phone="123456",
            address="1 Test St",
            city="Dublin",
            state="",
        )

        self.client = APIClient()

    def test_order_detail_owner_access(self):
        """Owner can access their order (200)."""
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(f"/orders/{self.order.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("order_number", resp.data)

    def test_order_detail_non_owner_forbidden(self):
        """Non-owner cannot access another user's order (404)."""
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.get(f"/orders/{self.order.id}/")
        self.assertIn(resp.status_code, (403, 404))

    def test_add_item_negative_quantity_returns_400(self):
        """Add item with negative quantity returns 400 Bad Request."""
        payload = {"cart_code": "test-123", "product_id": 1, "quantity": -1}
        resp = self.client.post("/add_item/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
