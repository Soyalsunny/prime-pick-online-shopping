from django.core.management.base import BaseCommand
from shop_app.models import Product
from django.core.files.base import ContentFile
import os
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import urllib.request


class Command(BaseCommand):
    help = 'Populate the database with sample products'

    def create_placeholder_image(self, category, color):
        """Create a simple placeholder image with PIL"""
        img = Image.new('RGB', (400, 500), color=color)
        draw = ImageDraw.Draw(img)
        
        # Add text
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except:
            font = ImageFont.load_default()
        
        text = category
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        position = ((400 - text_width) // 2, (500 - text_height) // 2)
        draw.text(position, text, fill='white', font=font)
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, format='JPEG', quality=85)
        img_io.seek(0)
        return img_io

    def handle(self, *args, **options):
        # Delete existing products first
        Product.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Cleared existing products'))

        # Sample product data with colors for placeholder images
        products_data = [
            {
                'name': 'Classic Crew T-Shirt',
                'category': 'T-Shirt',
                'price': '19.99',
                'description': 'Soft cotton crew neck t-shirt for daily wear.',
                'color': '#FF6B6B'  # Red
            },
            {
                'name': 'Oversized Graphic T-Shirt',
                'category': 'T-Shirt',
                'price': '24.99',
                'description': 'Relaxed fit graphic tee with breathable fabric.',
                'color': '#4ECDC4'  # Teal
            },
            {
                'name': 'V-Neck T-Shirt',
                'category': 'T-Shirt',
                'price': '21.99',
                'description': 'Lightweight v-neck t-shirt with a modern cut.',
                'color': '#45B7D1'  # Blue
            },
            {
                'name': 'Striped Casual T-Shirt',
                'category': 'T-Shirt',
                'price': '22.99',
                'description': 'Casual striped t-shirt perfect for weekend style.',
                'color': '#96CEB4'  # Green
            },
            {
                'name': 'Slim Fit Chino Pants',
                'category': 'Pants',
                'price': '44.99',
                'description': 'Stretch chino pants with slim fit silhouette.',
                'color': '#DDA15E'  # Brown
            },
            {
                'name': 'Relaxed Jogger Pants',
                'category': 'Pants',
                'price': '39.99',
                'description': 'Comfortable jogger pants with elastic waistband.',
                'color': '#6C757D'  # Gray
            },
            {
                'name': 'Classic Denim Pants',
                'category': 'Pants',
                'price': '54.99',
                'description': 'Durable denim pants with straight-leg fit.',
                'color': '#264653'  # Dark Blue
            },
            {
                'name': 'Formal Trousers',
                'category': 'Pants',
                'price': '49.99',
                'description': 'Tailored formal pants suitable for office wear.',
                'color': '#2A2A2A'  # Charcoal
            },
        ]

        # Create products with images
        for idx, product_data in enumerate(products_data):
            # Create placeholder image
            img_io = self.create_placeholder_image(
                product_data['category'], 
                product_data['color']
            )
            
            product = Product.objects.create(
                name=product_data['name'],
                category=product_data['category'],
                price=product_data['price'],
                description=product_data['description'],
            )
            
            # Save image to product
            filename = f"{product.slug}.jpg"
            product.image.save(filename, ContentFile(img_io.read()), save=True)
            
            self.stdout.write(self.style.SUCCESS(f'Created product: {product.name} with image'))

        self.stdout.write(self.style.SUCCESS('Successfully populated database with sample products!'))
