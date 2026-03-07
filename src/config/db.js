import mongoose from 'mongoose';

const connectDb = async () => {
   try {
      let conn;
      if (process.env.NODE_ENV === "production") {
         conn = await mongoose.connect(process.env.MONGO_URI_PROD);
      }
      else {
         conn = await mongoose.connect(process.env.MONGO_URI_LOCAL);
      }
      
      console.log(`MongoDB connected: ${conn.connection.host}`);

   }catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
   }
}

export default connectDb;