// A simple Error Handler Middleware that aids us to basically send responses back with proper status codes and error message


module.exports = (err, req, res, next) => {
     err.statusCode = err.statusCode || 500 ;

    
    if(process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            success : false,
            error : err,
            errMessage : err.message,
            stack : err.stack
        });


    }
    if(process.env.NODE_ENV === 'production'){
        let error = {...err};

        error.message = err.message;

        res.status(err.statusCode).json({
            success : false,
            message : error.message || 'Internal Server Error'
        });

    }
}