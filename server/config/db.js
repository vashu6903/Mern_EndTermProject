const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.dbURL;
    if (!uri) {
      throw new Error('Neither MONGO_URI nor dbURL is defined in environment variables.');
    }
    const conn = await mongoose.connect(uri, {
      autoIndex: true, // Build indexes automatically in development
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

