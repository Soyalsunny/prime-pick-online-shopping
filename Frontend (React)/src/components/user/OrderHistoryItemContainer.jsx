import OrderHistoryItem from "./OrderHistoryItem";

const OrderHistoryItemContainer = ({ orders, onCancelOrder, cancellingOrderId }) => {
  return (
    <div
      className="row"
      style={{
        minHeight: "300px",
        marginBottom: "50px",
      }}
    >
      <div className="col-md-12">
        <div
          className="card"
          style={{ width: "100%", maxHeight: "320px", overflow: "auto" }}
        >
          <div
            className="card-header"
            style={{
              backgroundColor: "#6050DC",
              color: "white",
              position: "sticky",
              top: "0",
              zIndex: "1",
              textAlign: "center",
            }}
          >
            <h5>Order History</h5>
          </div>

          {orders.length === 0 ? (
            <div className="p-4 text-center text-muted">You have not placed any orders yet.</div>
          ) : (
            orders.map((order) => (
              <OrderHistoryItem
                key={order.id}
                order={order}
                onCancelOrder={onCancelOrder}
                isCancelling={cancellingOrderId === order.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderHistoryItemContainer;
