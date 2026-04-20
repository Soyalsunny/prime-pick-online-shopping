import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div style={{ minHeight: "85.5vh", paddingTop: "80px" }}>
      <header
      className="py-2"
      style={{
        backgroundImage: "linear-gradient(to right, #6050DC, #8A50DC)",
        color: "white",
      }}
    >
      <div className="container px-4 px-lg-5 my-5">
        <div className="text-center text-white">
          {/* Title */}
          <h1
            className="display-4 fw-bold"
            style={{
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
              letterSpacing: "1px",
            }}
          >
            Page Not Found!
          </h1>
          {/* Subtitle */}
          <p
            className="lead fw-normal text-white-75 mb-4"
            style={{
              textShadow: "1px 1px 2px rgba(0, 0, 0, 0.4)",
            }}
          >
            The page you are looking for does not exist or has been moved.
          </p>
          {/* Back Home Button */}
          <Link
            to="/"
            className="btn btn-light btn-lg rounded-pill px-4 py-2"
            style={{
              color: "#6050DC",
              fontWeight: "bold",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.1)";
              e.target.style.boxShadow = "0 6px 15px rgba(0, 0, 0, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
            }}
          >
            Back Home
          </Link>
        </div>
      </div>
    </header>
    </div>
  );
};

export default NotFoundPage;
