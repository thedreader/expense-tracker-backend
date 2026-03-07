# Expense Tracker Backend

A Node.js backend API for an expense tracking application, built with Express.js and MongoDB.

## Features

- User authentication and authorization (JWT-based)
- Expense management (CRUD operations)
- Category management
- Monthly budget tracking
- Recurring charges handling
- Secure cookie-based authentication

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Password Hashing**: bcryptjs
- **Scheduling**: node-cron for recurring jobs
- **CORS**: Enabled for frontend integration

## Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ACCESS_TOKEN_SECRET=your_jwt_secret_key
   FRONTEND_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm start
   ```

The server will run on port 5000 by default.

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user

### Users
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile

### Expenses
- `GET /expenses` - Get all expenses
- `POST /expenses` - Create new expense
- `PUT /expenses/:id` - Update expense
- `DELETE /expenses/:id` - Delete expense

### Categories
- `GET /categories` - Get all categories
- `POST /categories` - Create new category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

### Monthly Budget
- `GET /budget` - Get monthly budget
- `POST /budget` - Set monthly budget
- `PUT /budget/:id` - Update budget

## Project Structure

```
backend/
├── src/
│   ├── app.js                 # Main Express app setup
│   ├── server.js              # Server entry point
│   ├── config/
│   │   └── db.js              # Database connection
│   ├── controllers/           # Route handlers
│   ├── middleware/            # Custom middleware
│   ├── models/                # Mongoose models
│   ├── routes/                # API routes
│   ├── utils/                 # Utility functions
│   └── jobs/                  # Scheduled jobs
├── package.json
└── README.md
```

## Scripts

- `npm start` - Start the development server with nodemon

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License