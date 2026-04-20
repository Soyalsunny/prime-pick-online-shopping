const Error = ({ message, error }) => {
  const errorText = message || error;
  
  return (
    errorText && (
      <div className="alert alert-danger my-2 d-flex justify-content-center align-items-center" role="alert">
        {errorText}
      </div>
    )
  );
};

export default Error;
