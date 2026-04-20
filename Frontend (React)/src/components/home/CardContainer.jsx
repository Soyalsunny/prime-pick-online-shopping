import styles from "./HomeCard.module.css"
import HomeCard from "./HomeCard";

const CardContainer = ({ products }) => {
  return (
    <section className="py-5" id="shop">
      <h5 className={`${styles.newProductHeading} mb-4`}>New Products</h5>

      <div className="container px-4 px-lg-5 mt-5">
        <div className="row justify-content-center">
          {products.map((product) => (
            <HomeCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CardContainer;
