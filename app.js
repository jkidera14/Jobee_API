const express = require('express');
const app = express();
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

//Now we call the database connection
const connectDatabase = require('./config/database');
const errorMiddleware = require('./middlewares/errors');
const ErrorHandler = require('./utils/errorHandler');


//Setting up config.env file variables
//dotenv.config({path:'./config/config.env'})
dotenv.config({path : './config/config.env'})

// Handling Uncaught Exception
process.on('uncaughtException', err =>{
    console.log(`ERROR: ${err.message}`);
    console.log('Shutting down due to uncaught exception.');
    process.exit(1);
});

//Connecting to database
connectDatabase();

// Setup Security headers
app.use(helmet());

// Setup body parser
app.use(express.json());

//Setting the Cookie Parser
app.use(cookieParser());

// Handle File uploads
app.use(fileUpload());

// Sanitize Data
app.use(mongoSanitize());

// Prevent xss Attacks
app.use(xssClean());

// Prevent Parameter Pollution
app.use(hpp());

// Rate Limiting
const limiter = rateLimit({
    windowsMs: 10*60*1000, // 10 Mins
    max : 100
});

app.use(limiter);

// Setup CORS - Accessible By Other Domains
app.use(cors());

// Importing All routes
const jobs = require('./routes/jobs');
const auth = require('./routes/auth');
const user = require('./routes/user');

app.use('/api/v1', jobs);
app.use('/api/v1', auth);
app.use('/api/v1', user);

// Handle unhandled routes
app.all('/{*splat}', (req, res, next) => {
    next(new ErrorHandler(`${req.originalUrl} route not found`, 404));
});

//Middleware to handle errors
app.use(errorMiddleware);

const PORT = process.env.PORT;
const server = app.listen(PORT, () => {
    console.log(`Server started Successfully on port ${process.env.PORT} in ${process.env.NODE_ENV} Mode.`);
});

//Handling Unhandled Promise Rejection
process.on('unhandledRejection', err => {
    console.log(`Error: ${err.message}.`);
    console.log('Shutting down the server due to unhandled promise rejection')
    server.close( () => {
        process.exit(1);
    })
});
