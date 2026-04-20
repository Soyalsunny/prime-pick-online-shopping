import { useState, useEffect } from 'react';
import api from '../../api';
import styles from './ShopPage.module.css';
import ShopCard from './ShopCard';
import Error from '../ui/Error';
import PlaceHolderContainer from '../ui/PlaceHolderContainer';

const ShopPage = ({ setNumCartItems }) => {
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'T-Shirt', 'Pants'];
  const normalizeSearchQuery = (value) => value.replace(/[^\w\s-]/g, '').slice(0, 40).trim();

  // Fetch all products on mount
  useEffect(() => {
    setLoading(true);
    setError(''); // Clear previous errors
    api
      .get('/products')
      .then((res) => {
        setAllProducts(res.data);
        setFilteredProducts(res.data);
        setError(''); // Clear any errors on success
        setLoading(false);
      })
      .catch((err) => {
        const statusCode = err?.response?.status;
        const responseError = err?.response?.data?.error;
        const details = responseError || err?.message || 'Unknown error';
        console.error('Failed to load products:', {
          statusCode,
          details,
          url: err?.config?.url,
          baseURL: err?.config?.baseURL,
        });
        setError(`Failed to load products. ${statusCode ? `Status ${statusCode}: ` : ''}${details}`);
        setLoading(false);
      });
  }, []);

  // Filter and search products
  useEffect(() => {
    let filtered = allProducts;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    // Filter by search query
    const safeQuery = normalizeSearchQuery(searchQuery).toLowerCase();
    if (safeQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(safeQuery) ||
          (product.description || '').toLowerCase().includes(safeQuery)
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, allProducts]);

  return (
    <div className={styles.shopContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Shop T-Shirts & Pants</h1>
        <p className={styles.subtitle}>Browse our collection of {allProducts.length} products</p>
      </div>

      {error && <Error message={error} />}

      {/* Search and Filter Section */}
      <div className={styles.filterSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(normalizeSearchQuery(e.target.value))}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>

        <div className={styles.categoryFilter}>
          <label htmlFor="category" className={styles.filterLabel}>
            Category:
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.resultCount}>
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Products Grid */}
      {loading && <PlaceHolderContainer />}

      {!loading && filteredProducts.length > 0 && (
        <div className="container px-4 px-lg-5 my-5">
          <div className={`row ${styles.productsGrid}`}>
            {filteredProducts.map((product) => (
              <ShopCard
                key={product.id}
                product={product}
                setNumCartItems={setNumCartItems}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && filteredProducts.length === 0 && !error && (
        <div className={styles.noProducts}>
          <p>No products found matching your search.</p>
          <button
            className={styles.resetBtn}
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
