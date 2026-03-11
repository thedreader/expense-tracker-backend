import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import monthlyBudgetRoutes from './routes/monthlyBudgetRoutes.js';
// import { errorHandler } from './middlewares/errorMiddleware.js';

const app = express();

app.use(cors({
   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
   credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/expenses', expenseRoutes);
app.use('/categories', categoryRoutes);
app.use('/budget', monthlyBudgetRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// app.use(errorHandler);

export default app;
