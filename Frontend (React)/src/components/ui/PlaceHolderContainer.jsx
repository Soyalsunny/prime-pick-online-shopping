import PlaceHolder from './PlaceHolder'

const PlaceHolderContainer = () => {
    const placeNumbers = [...Array(12).keys()].slice(0);

  return (
    <section className="py-5" id="shop">
        <h4
        style={{
          textAlign: "center",
          fontSize: "2rem",
          fontWeight: "bold",
          textShadow: "2px 2px 5px rgba(0, 0, 0, 0.4)",
          marginBottom: "20px",
          textTransform: "uppercase"
        }}
      >
        New Products
      </h4>

        <div className="container px-5 px-lg-5 mt-5">
            <div className="row justify-content-center">
                {placeNumbers.map(num => <PlaceHolder key={num} />)}
            </div>
        </div>
    </section>
  )
}

export default PlaceHolderContainer