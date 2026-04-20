import "./header.css";

const Header = () => {
  return (
    <header className="header">
      <div className="container px-4 px-lg-5 my-5 pt-5 header-container">
        <div className="text-white">
          <h1 className="display-4 fw-bold mt-3 header-title">
            Step Into the World of Style
          </h1>
          <p className="lead fw-normal text-white-75 mb-4 header-paragraph">
            Find your perfect look with our trendsetting collection.
          </p>

          <a
            href="#shop"
            className="btn btn-light btn-lg rounded-pill px-4 py-2 header-button"
            style={{
              background: "linear-gradient(to right, #FF5733, #FF8C33)",
              border: "none",
              color: "white",
              fontWeight: "bold",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.1)";
              e.target.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "none";
            }}
          >
            Shop Now
          </a>
        </div>
      </div>

      <div className="header-overlay"></div>
    </header>
  );
};

export default Header;
