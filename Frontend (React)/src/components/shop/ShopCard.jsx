import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BASE_URL } from '../../api';
import api from '../../api';
import styles from './ShopCard.module.css';
import { toast } from 'react-toastify';

const ShopCard = ({ product, setNumCartItems }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const isOutOfStock = !product.is_in_stock || Number(product.stock) <= 0;

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (isOutOfStock) {
      toast.error('This product is currently out of stock.');
      return;
    }
    setLoading(true);

    const cart_code = localStorage.getItem('cart_code');
    const itemData = {
      cart_code: cart_code,
      product_id: product.id,
      quantity: parseInt(quantity),
    };

    api
      .post('add_item/', itemData)
      .then((res) => {
        console.log(res.data);
        toast.success(`${product.name} added to cart!`);
        setQuantity(1);
        setLoading(false);

        // Update cart count
        api.get(`get_cart_stat?cart_code=${cart_code}`).then((res) => {
          setNumCartItems(res.data.num_of_items);
        });
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to add item to cart');
        setLoading(false);
      });
  };

  return (
    <div className={`col-md-4 col-lg-3 ${styles.shopCol}`}>
      <div className={styles.shopCard}>
        <Link to={`/products/${product.slug}`} className={styles.imageLink}>
          <div className={styles.imageWrapper}>
            <img
              src={`${BASE_URL}${product.image}`}
              alt={product.name}
              className={styles.productImage}
            />
            <div className={styles.overlay}>
              <span className={styles.viewDetail}>View Details</span>
            </div>
          </div>
        </Link>

        <div className={styles.cardBody}>
          <h5 className={styles.productName}>{product.name}</h5>
          <p className={styles.productCategory}>{product.category}</p>
          {isOutOfStock && <span className={styles.stockBadgeOut}>Out of Stock</span>}
          <p className={styles.productDescription}>
            {product.description.substring(0, 60)}
            {product.description.length > 60 ? '...' : ''}
          </p>
          <div className={styles.priceSection}>
            <span className={styles.price}>${product.price}</span>
          </div>

          <div className={styles.cartSection}>
            <div className={styles.quantityControl}>
              <button
                className={styles.quantityBtn}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={loading || isOutOfStock}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max={Math.max(1, Number(product.stock) || 1)}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className={styles.quantityInput}
                disabled={loading || isOutOfStock}
              />
              <button
                className={styles.quantityBtn}
                onClick={() => setQuantity(quantity + 1)}
                disabled={loading || isOutOfStock || quantity >= Number(product.stock || 0)}
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className={styles.addToCartBtn}
              disabled={loading || isOutOfStock}
            >
              {loading ? 'Adding...' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCard;
