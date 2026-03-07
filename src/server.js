import dotenv from 'dotenv';
import connectDb from './config/db.js';
import app from './app.js';
import './jobs/recurring.job.js';

dotenv.config();

const port =  5000;

connectDb();

app.listen(port, () => {
   console.log('Server is running on ' + port);
   
})