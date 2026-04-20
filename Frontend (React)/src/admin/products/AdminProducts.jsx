import { useCallback, useEffect, useRef, useState } from "react";
import api, { BASE_URL } from "../../api";
import styles from "./AdminProducts.module.css";

const CATEGORIES = ["T-Shirt", "Pants"];
const EMPTY_FORM = {
  name: "",
  description: "",
  category: "T-Shirt",
  price: "",
  stock: "",
  image: null,
};

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null); // null = add mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState(null);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get("admin-api/products")
      .then((res) => setProducts(res.data))
      .catch(() => setError("Failed to load products."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ---- Modal helpers ----
  const openAdd = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setImagePreview("");
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      category: product.category || "T-Shirt",
      price: product.price,
      stock: product.stock,
      image: null, // user must re-upload to change
    });
    setFormErrors({});
    setImagePreview(product.image_url || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditProduct(null);
    setFormErrors({});
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm((prev) => ({ ...prev, image: file }));
    setImagePreview(URL.createObjectURL(file));
    setFormErrors((prev) => ({ ...prev, image: "" }));
  };

  // ---- Save (create / update) ----
  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.description.trim()) errors.description = "Description is required.";
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0)
      errors.price = "Enter a valid price.";
    if (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0)
      errors.stock = "Enter a valid stock count.";
    if (!editProduct && !form.image) errors.image = "At least one photo is required.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("description", form.description.trim());
    data.append("category", form.category);
    data.append("price", form.price);
    data.append("stock", form.stock);
    if (form.image) data.append("image", form.image);

    try {
      if (editProduct) {
        await api.patch(`admin-api/products/${editProduct.id}/`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("admin-api/products", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      const serverErrors = err.response?.data || {};
      if (typeof serverErrors === "object") {
        setFormErrors(serverErrors);
      } else {
        setFormErrors({ general: "Save failed. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.delete(`admin-api/products/${id}/`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Quick stock toggle ----
  const handleToggleStock = async (product) => {
    const newStock = product.stock > 0 ? 0 : 10;
    try {
      const res = await api.patch(
        `admin-api/products/${product.id}/`,
        { stock: newStock },
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setProducts((prev) => prev.map((p) => (p.id === product.id ? res.data : p)));
    } catch {
      alert("Failed to update stock.");
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>Products</h2>
          <p className={styles.pageSubtitle}>
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          + Add Product
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    No products yet. Click &ldquo;+ Add Product&rdquo; to get started.
                  </td>
                </tr>
              )}
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <img
                      src={
                        product.image_url ||
                        `${BASE_URL}/${product.image}` ||
                        "https://via.placeholder.com/56"
                      }
                      alt={product.name}
                      className={styles.thumb}
                    />
                  </td>
                  <td className={styles.nameCell}>{product.name}</td>
                  <td>
                    <span className={styles.catBadge}>{product.category}</span>
                  </td>
                  <td>${Number(product.price).toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className={styles.stockInput}
                      value={product.stock}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) return;
                        try {
                          const res = await api.patch(
                            `admin-api/products/${product.id}/`,
                            { stock: val },
                            { headers: { "Content-Type": "multipart/form-data" } }
                          );
                          setProducts((prev) =>
                            prev.map((p) => (p.id === product.id ? res.data : p))
                          );
                        } catch {
                          // ignore
                        }
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className={`${styles.stockToggle} ${product.is_in_stock ? styles.inStock : styles.outStock}`}
                      onClick={() => handleToggleStock(product)}
                      title={product.is_in_stock ? "Mark as out of stock" : "Mark as in stock (set to 10)"}
                    >
                      {product.is_in_stock ? "In Stock" : "Out of Stock"}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                      >
                        {deletingId === product.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Product Form Modal ---- */}
      {modalOpen && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>
                {editProduct ? "Edit Product" : "Add Product"}
              </h4>
              <button className={styles.closeBtn} onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.modalBody} noValidate>
              {formErrors.general && (
                <div className="alert alert-danger py-2">{formErrors.general}</div>
              )}

              <div className={styles.formGrid}>
                {/* Name */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFieldChange}
                    className={`${styles.input} ${formErrors.name ? styles.inputError : ""}`}
                    placeholder="Product name"
                  />
                  {formErrors.name && (
                    <p className={styles.fieldError}>{formErrors.name}</p>
                  )}
                </div>

                {/* Category */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Category</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleFieldChange}
                    className={styles.input}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Price ($) <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleFieldChange}
                    min="0"
                    step="0.01"
                    className={`${styles.input} ${formErrors.price ? styles.inputError : ""}`}
                    placeholder="0.00"
                  />
                  {formErrors.price && (
                    <p className={styles.fieldError}>{formErrors.price}</p>
                  )}
                </div>

                {/* Stock */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Stock <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={handleFieldChange}
                    min="0"
                    className={`${styles.input} ${formErrors.stock ? styles.inputError : ""}`}
                    placeholder="0"
                  />
                  {formErrors.stock && (
                    <p className={styles.fieldError}>{formErrors.stock}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className={styles.formGroup} style={{ marginTop: 12 }}>
                <label className={styles.label}>
                  Description <span className={styles.required}>*</span>
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFieldChange}
                  rows={4}
                  className={`${styles.input} ${formErrors.description ? styles.inputError : ""}`}
                  placeholder="Product description..."
                />
                {formErrors.description && (
                  <p className={styles.fieldError}>{formErrors.description}</p>
                )}
              </div>

              {/* Image */}
              <div className={styles.formGroup} style={{ marginTop: 12 }}>
                <label className={styles.label}>
                  Photo{" "}
                  {!editProduct && <span className={styles.required}>* required</span>}
                  {editProduct && (
                    <span className={styles.optionalNote}>
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <div
                  className={styles.imageUploadArea}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className={styles.imagePreview}
                    />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      Click to select photo
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
                {formErrors.image && (
                  <p className={styles.fieldError}>{formErrors.image}</p>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelModalBtn}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={saving}
                >
                  {saving ? "Saving..." : editProduct ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
