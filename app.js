const express = require('express');
const app = express();
const dotenv = require('dotenv');

//Now we call the database connection
const connectDatabase = require('./config/database');
const errorMiddleware = require('./middlewares/errors');

//Setting up config.env file variables
//dotenv.config({path:'./config/config.env'})
dotenv.config({path : './config/config.env'})

//Connecting to database
connectDatabase();

// Setup body parser
app.use(express.json());

// Importing All routes
const jobs = require('./routes/jobs');

app.use('/api/v1',jobs);

//Middleware to handle errors
app.listen(errorMiddleware);

const PORT = process.env.PORT;
app.listen(PORT, ()=>{
    console.log(`Server started Successfully on port ${process.env.PORT} in ${process.env.NODE_ENV} Mode.`);
});