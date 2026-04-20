import { BASE_URL } from "../../api";
import styles from "./OrderItem.module.css";

const OrderItem = ({ CartItem}) => {
  return (
    <div className={`d-flex align-items-center mb-3 ${styles.orderItem}`}>
      {/* Item Image */}
      <div className={`${styles.imageWrapper}`}>
        <img
          src={`${BASE_URL}${CartItem.product.image}`}
          alt=""
          className={`${styles.image}`}
        />
      </div>

      {/* Item Details */}
      <div className="ms-3 flex-grow-1">
        <h6 className={`${styles.itemName}`}>{CartItem.product.name}</h6>
        <p className={`${styles.itemDetails}`}>
          Quantity: <strong>{CartItem.quantity}</strong>{" "}
          <span className={styles.spacer}> </span> Price:{" "}
          <strong>${CartItem.product.price}</strong>
        </p>
      </div>
    </div>
  );
};

export default OrderItem;
